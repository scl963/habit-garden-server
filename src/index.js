const { GraphQLServer } = require('graphql-yoga');
const { Prisma } = require('prisma-binding');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').load();
}

function getUserId(context) {
  const Authorization = context.request.get('Authorization');
  if (Authorization) {
    const token = Authorization.replace('Bearer ', '');
    const { userId } = jwt.verify(token, process.env.APP_SECRET);
    return userId;
  }

  throw new Error('Not authenticated');
}

const resolvers = {
  Query: {
    user: (root, args, context, info) => {
      return context.db.query.user({ where: { id: args.userId }}, info)
    },
    users: (root, args, context, info) => {
      return context.db.query.users({}, info);
    },
    habits: (root, args, context, info) => {
      return context.db.query.habits({}, info);
    },
    inputs: (root, args, context, info) => {
      return context.db.query.dailyInputs({}, info);
    },
    _usersMeta: async (root, args, context, info) => {
      const data = await context.db.query.usersConnection({}, ` { aggregate { count } } `);
      return { count: data.aggregate.count };
    },
    _habitsMeta: async (root, args, context, info) => {
      const data = await context.db.query.habitsConnection({}, ` { aggregate { count } } `);
      return { count: data.aggregate.count };
    },
  },
  AuthPayload: {
    user: async (root, args, context, info) => {
      return context.db.query.user({ where: { id: root.user.id } }, info);
    },
  },
  User: {
    id: root => root.id,
    email: root => root.email,
    firstName: root => root.firstName,
    habits: root => root.habits,
  },
  Mutation: {
    signup: async (parent, args, context, info) => {
      const password = await bcrypt.hash(args.password, 10);
      const user = await context.db.mutation.createUser(
        {
          data: {
            email: args.email,
            firstName: args.firstName,
            habits: [],
            password,
          },
        },
        ` { id password email } `,
      );
      const token = jwt.sign({ userId: user.id }, process.env.APP_SECRET);
      return {
        token,
        user,
      };
    },
    login: async (parent, args, context, info) => {
      const user = await context.db.query.user(
        { where: { email: args.email } },
        ` { id password } `,
      );
      if (!user) {
        throw new Error('No such user found');
      }
      const valid = await bcrypt.compare(args.password, user.password);
      if (!valid) {
        throw new Error('Invalid password');
      }
      const token = jwt.sign({ userId: user.id }, process.env.APP_SECRET);
      return {
        token,
        user,
      };
    },
    createHabitForUser: (root, args, context, info) => {
      const userId = getUserId(context);
      return context.db.mutation.createHabit(
        {
          data: {
            user: {
              connect: {
                id: userId,
              },
            },
            name: args.name,
            inputs: [],
          },
        },
        info,
      );
    },
    createInputForHabit: (root, args, context, info) => {
      const userId = getUserId(context);
      return context.db.mutation.createDailyInput(
        {
          data: {
            habit: {
              connect: {
                id: args.habitId,
              },
            },
            date: args.date,
            amount: args.amount,
          },
        },
        info,
      );
    },
  },
};

let server = new GraphQLServer({
  typeDefs: './src/schema.graphql',
  resolvers,
  context: req => ({
    ...req,
    db: new Prisma({
      typeDefs: 'src/generated/prisma.graphql',
      endpoint: 'https://habit-tracker-prisma-server.herokuapp.com',
      secret: process.env.API_SECRET,
      debug: true,
    }),
  }),
});
server.start(() => console.log(`Server is running on port 4000`));
