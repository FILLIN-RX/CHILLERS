"use client";

import React, { useEffect } from "react";
import LivePlayer from "@/components/LivePlayer";
import type { LiveChannel } from "@/types/live";
import { acquireModalScrollLock, releaseModalScrollLock } from "@/lib/modalScrollLock";

/**
 * Lecteur plein écran en modal (remplace les anciennes pages détail /live/[slug]).
 * Le flux doit déjà être résolu (streamUrl renseigné).
 * Dispatch des évènements pour masquer la BottomNav sur mobile et verrouiller le scroll.
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
  useEffect(() => {
    acquireModalScrollLock();
    window.dispatchEvent(new Event("live-modal-open"));
    return () => {
      window.dispatchEvent(new Event("live-modal-close"));
      releaseModalScrollLock();
    };
  }, []);

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
