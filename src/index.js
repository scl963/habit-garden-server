const { GraphQLServer } = require('graphql-yoga');
const { Prisma } = require('prisma-binding');

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').load();
}

const resolvers = {
  Query: {
    users: (root, args, context, info) => {
      return context.db.query.users({}, info);
    },
    user: (root, args, context, info) => {
      return context.db.query.user(
        {
          where: {
            id: args.userId,
          },
        },
        info,
      );
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
  User: {
    id: root => root.id,
    email: root => root.email,
    firstName: root => root.firstName,
    habits: root => root.habits,
  },
  Mutation: {
    createUser: (root, args, context, info) => {
      return context.db.mutation.createUser(
        {
          data: {
            email: args.email,
            firstName: args.firstName,
            habits: [],
          },
        },
        info,
      );
    },
    createHabitForUser: (root, args, context, info) => {
      return context.db.mutation.createHabit(
        {
          data: {
            user: {
              connect: {
                id: args.userId,
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
      endpoint: process.env.PRISMA_DB_ENDPOINT,
      secret: process.env.API_SECRET,
      debug: true,
    }),
  }),
});
server.start(() => console.log(`Server is running on http://localhost:4000`));
