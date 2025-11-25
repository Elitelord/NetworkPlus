import Image from "next/image";
import Navbar  from "../components/navbar";
import { Hero1 } from "@/components/hero1";
export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-between  ">
        <header>
          {/* <Navbar /> */}
          <Hero1 badge = "Network Plus" heading = "Welcome to Network Plus!" description = "insert description here" image = {{ src: "/images/network-plus.png", alt: "Network Plus hero image" }}/>
        </header>
      </main>
    </div>
  );
}
