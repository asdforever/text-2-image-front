import { CanvasStudio } from "../components/image-canvas/CanvasStudio";

export function BoardPage(props: { suiteId: string; embedded?: boolean; active?: boolean; navigate: (to: string) => void }) {
  return <CanvasStudio {...props} />;
}
