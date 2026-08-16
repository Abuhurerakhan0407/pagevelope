import MotionStudio from "./motion-studio";

type PageProps = {
  searchParams: Promise<{ workspaceId?: string; campaignId?: string }>;
};

export const dynamic = "force-dynamic";

export default async function MotionStudioPage({ searchParams }: PageProps) {
  const query = await searchParams;
  return (
    <MotionStudio
      workspaceId={query.workspaceId?.trim() ?? ""}
      campaignId={query.campaignId?.trim() ?? ""}
    />
  );
}
