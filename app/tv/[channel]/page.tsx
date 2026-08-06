import { notFound } from "next/navigation";
import { TvDisplay } from "@/components/TvDisplay";
import { resolveDynamicTvChannel } from "@/lib/displayChannels";

interface TvChannelPageProps {
  params: Promise<{ channel: string }>;
}

export default async function TvChannelPage({ params }: TvChannelPageProps) {
  const { channel } = await params;
  const kioskId = resolveDynamicTvChannel(channel);

  if (!kioskId) notFound();

  return <TvDisplay kioskId={kioskId} channelLabel={kioskId} />;
}
