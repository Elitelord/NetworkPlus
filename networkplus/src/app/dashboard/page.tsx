"use client";
import { useEffect, useRef } from "react";
import Image from "next/image";
import Navbar  from "../../components/navbar";
import { Button } from "@/components/ui/button";
import ForceGraph from 'force-graph';
const graphData = 
    {
    "nodes": [
        {
          "id": "id1",
          "name": "name1",
          "val": 1,
          "group": "Family"
        },
        {
          "id": "id2",
          "name": "name2",
          "val": 10,
          "group": "Friends"
        }
        
    ],
    "links": [
        {
            "source": "id1",
            "target": "id2"
        }
    ]
    };
export default function Home() {
  

  const graphRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = graphRef.current;
    if (!el) return;
    const myGraph = new ForceGraph(el).graphData(graphData);
    return () => {
      // Basic cleanup: reset graph data to avoid leaks
      try {
        myGraph.graphData({ nodes: [], links: [] });
      } catch {
        // ignore if cleanup isn't supported by the lib
      }
    };
  }, [graphData]);

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
          <div id="graph" ref={graphRef} style={{ width: '600px', height: '400px', alignItems:"left" }}></div>
        </header>
      </main>
    </div>
  );
}