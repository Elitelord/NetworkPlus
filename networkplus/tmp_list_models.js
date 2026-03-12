
const fs = require('fs');
async function listModels() {
  const apiKey = "AIzaSyDYKN5VngzOUf5h99Hcj8AMagl0KZNMjU4";
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await res.json();
    if (data.models) {
      const output = data.models.map(m => m.name).join("\n");
      fs.writeFileSync('tmp_models_utf8.txt', output, 'utf8');
      console.log("Success: Written to tmp_models_utf8.txt");
    } else {
      console.log("No models found or error:", JSON.stringify(data));
    }
  } catch (error) {
    console.error("Error listing models:", error);
  }
}

listModels();
