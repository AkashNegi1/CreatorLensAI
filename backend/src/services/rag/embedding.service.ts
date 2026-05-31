import { pipeline } from "@huggingface/transformers";

let extractor: any = null;

async function getExtractor() {
  if (!extractor) {
    try {
      extractor = await pipeline(
        "feature-extraction",
        "./src/models/bge-small",
        {
          local_files_only: true, // Critical: Forces offline mode
          progress_callback: (data) => console.log(data),
        },
      );
    } catch (error) {
      console.error("Failed to load local model. Check file paths.", error);
      throw error;
    }
  }

  return extractor;
}

async function runEmbedding(text: string): Promise<number[]> {
  const model = await getExtractor();

  const output = await model(text, {
    pooling: "mean",
    normalize: true,
  });

  return Array.from(output.data) as number[];
}

export async function embedDocument(text: string): Promise<number[]> {
  return runEmbedding(text);
}

export async function embedDocuments(texts: string[]): Promise<number[][]> {
  const concurrency = 4;
  const vectors: number[][] = [];

  for (let i = 0; i < texts.length; i += concurrency) {
    const batch = texts.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(embedDocument));
    vectors.push(...batchResults);
  }

  return vectors;
}

export async function embedQuery(text: string): Promise<number[]> {
  return runEmbedding(
    `Represent this sentence for searching relevant passages: ${text}`,
  );
}
