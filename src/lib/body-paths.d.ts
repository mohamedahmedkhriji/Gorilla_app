declare const bodyPaths: Record<
  string,
  Record<
    'front' | 'back',
    {
      vb: string;
      p: Record<string, string[]>;
    }
  >
>;

export default bodyPaths;
