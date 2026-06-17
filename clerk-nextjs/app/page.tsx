import { auth } from "@clerk/nextjs/server";
import { Show } from "@clerk/nextjs";

export default async function Home() {
  const { userId } = await auth();

  return (
    <div className="flex flex-col items-center justify-center flex-grow p-8 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
      <div className="max-w-md w-full p-6 bg-white dark:bg-zinc-900 rounded-xl shadow-md border border-zinc-200 dark:border-zinc-800 text-center">
        <Show when="signed-in">
          <h2 className="text-2xl font-bold mb-2 text-green-600 dark:text-green-400">Welcome Back!</h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-4">You are successfully authenticated.</p>
          <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded font-mono text-xs text-left overflow-auto break-all">
            <span className="font-bold">User ID:</span> {userId}
          </div>
        </Show>
        <Show when="signed-out">
          <h2 className="text-2xl font-bold mb-2">Hello Guest</h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-4">Please sign in or sign up using the buttons in the header to view your profile details.</p>
        </Show>
      </div>
    </div>
  );
}
