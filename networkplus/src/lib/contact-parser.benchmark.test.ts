import { describe, it, expect } from "vitest";
import { parseCSV } from "./contact-parser";

describe("contact-parser benchmarking", () => {
    it("benchmark: should handle 50,000 rows", async () => {
        let csvContent = "First Name,Last Name,Email Address,Company,Position,URL,Connected On\n";
        for (let i = 0; i < 50000; i++) {
            csvContent += `User${i},Test,user${i}@example.com,LoadTestCorp,Engineer,https://linkedin.com/in/user${i},15 Feb 2026\n`;
        }
        const file = new File([csvContent], "benchmark.csv", { type: "text/csv" });
        
        const start = performance.now();
        const result = await parseCSV(file);
        const end = performance.now();
        
        console.log(`Parsed 50,000 rows in ${end - start}ms`);
        
        expect(result.valid).toHaveLength(50000);
    });

    it("benchmark: should handle 10k rows with many extra columns", async () => {
        let headers = "First Name,Last Name,Email Address,Company";
        for (let i = 0; i < 50; i++) {
            headers += `,ExtraCol${i}`;
        }
        headers += "\n";

        let csvContent = headers;
        for (let i = 0; i < 10000; i++) {
            let row = `User${i},Test,user${i}@example.com,LoadTestCorp`;
            for (let j = 0; j < 50; j++) {
                row += `,Value${j}`;
            }
            csvContent += row + "\n";
        }
        const file = new File([csvContent], "benchmark_extra.csv", { type: "text/csv" });

        const start = performance.now();
        const result = await parseCSV(file);
        const end = performance.now();

        console.log(`Parsed 10,000 rows with 50 extra columns in ${end - start}ms`);

        expect(result.valid).toHaveLength(10000);
    });
});
