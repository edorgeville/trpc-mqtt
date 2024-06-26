import { initTRPC } from '@trpc/server';

export type AppRouter = typeof appRouter;

export async function createContext() {
  return { hello: 'world' };
}

export type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create();

const publicProcedure = t.procedure;
const router = t.router;

const state = { count: 0 };

export const appRouter = router({
  greet: publicProcedure
    .input((val: unknown) => {
      if (typeof val === 'string') return val;
      throw new Error(`Invalid input: ${typeof val}`);
    })
    .query(({ input }) => ({ greeting: `hello, ${input}!` })),
  countUp: publicProcedure
    .input((val: unknown) => {
      if (typeof val === 'number') return val;
      throw new Error(`Invalid input: ${typeof val}`);
    })
    .mutation(({ input }) => {
      state.count += input;
      return state.count;
    }),
  slow: publicProcedure.query(async () => {
    await new Promise(resolve => setTimeout(resolve, 10 * 1000));
    return 'done';
  }),
  getContext: publicProcedure.query(({ ctx }) => {
    return ctx;
  })
});
