"use client";

import React from "react";
import LivePlayer from "@/components/LivePlayer";
import type { LiveChannel } from "@/types/live";

/**
 * Lecteur plein écran en modal (remplace les anciennes pages détail /live/[slug]).
 * Le flux doit déjà être résolu (streamUrl renseigné).
 */
export default function LivePlayerModal({
  channel,
  allChannels,
  onClose,
  onSelectChannel,
}: {
  channel: LiveChannel;
  allChannels?: LiveChannel[];
  onClose: () => void;
  onSelectChannel?: (ch: LiveChannel) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black">
      <LivePlayer
        key={channel._id}
        channel={channel}
        allChannels={allChannels}
        fill
        onBack={onClose}
        onSelectChannel={onSelectChannel}
      />
    </div>
  );
}
