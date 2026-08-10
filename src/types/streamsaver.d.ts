declare module "streamsaver" {
  interface StreamSaverWriteStream {
    write(chunk: Uint8Array): boolean;
    close(): Promise<void>;
    abort(reason?: unknown): void;
    readonly locked: boolean;
  }
  interface StreamSaver {
    mitm: string;
    createWriteStream(
      filename: string,
      options?: { size?: number; pathname?: string },
    ): StreamSaverWriteStream;
  }
  const streamSaver: StreamSaver;
  export default streamSaver;
}