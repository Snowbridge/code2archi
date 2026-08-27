import type { ProcessorId } from "./processor-id.js";

export interface IProcessor<TInput, TOutput> {
  readonly id: ProcessorId;
  readonly version: string;
  process(input: TInput): TOutput | Promise<TOutput>;
}
