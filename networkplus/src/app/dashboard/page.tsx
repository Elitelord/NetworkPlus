import Image from "next/image";
import Navbar  from "../../components/navbar";
import { Button } from "@/components/ui/button";
export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-between  ">
        <header>
          {/* <Navbar /> */}
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
            Welcome to Plus!
          </h1>
          <Button>
            Add Person
          </Button>
        </header>
      </main>
    </div>
  );
}