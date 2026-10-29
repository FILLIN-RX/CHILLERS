/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import FollowMatchButton from "@/components/live/FollowMatchButton";
import { userService } from "@/services/user";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: mockPush }) }));

let mockToken: string | null = "token";
jest.mock("@/stores/useAuthStore", () => ({
  useAuthStore: (selector: (state: { token: string | null }) => unknown) => selector({ token: mockToken }),
}));

jest.mock("@/services/user", () => ({
  userService: {
    getPushConfig: jest.fn(),
    getPushPreferences: jest.fn(),
    subscribePush: jest.fn(),
    updatePushPreferences: jest.fn(),
  },
}));

const service = userService as jest.Mocked<typeof userService>;

const subscription = {
  endpoint: "https://push.example/device",
  toJSON: () => ({ endpoint: "https://push.example/device", keys: { p256dh: "k", auth: "a" } }),
};
const registration = {
  pushManager: {
    getSubscription: jest.fn(),
    subscribe: jest.fn(),
  },
};

function enablePushApi(permission: NotificationPermission = "granted") {
  Object.defineProperty(window, "Notification", {
    configurable: true,
    value: { permission, requestPermission: jest.fn().mockResolvedValue(permission) },
  });
  Object.defineProperty(window, "PushManager", { configurable: true, value: function PushManager() {} });
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { ready: Promise.resolve(registration) },
  });
}

const followButton = () =>
  screen.getByRole("button", { name: /recevoir une notification|ne plus recevoir/i });

beforeEach(() => {
  jest.clearAllMocks();
  mockToken = "token";
  enablePushApi();
  registration.pushManager.getSubscription.mockResolvedValue(null);
  registration.pushManager.subscribe.mockResolvedValue(subscription);
  service.getPushConfig.mockResolvedValue({ success: true, data: { enabled: true, publicKey: "AAAA" } });
  service.getPushPreferences.mockResolvedValue({
    success: true,
    data: [{ preferences: { announcements: true, favorites: true, matches: true, subscriptions: true, reminders: true }, followedTeams: [] }],
  });
  service.subscribePush.mockResolvedValue({ success: true, data: { linkedToAccount: true } });
  service.updatePushPreferences.mockResolvedValue({
    success: true,
    data: { preferences: { announcements: true, favorites: true, matches: true, subscriptions: true, reminders: true }, followedTeams: [] },
  });
});

it("renvoie vers la connexion quand aucun compte n'est ouvert", () => {
  mockToken = null;
  render(<FollowMatchButton home="Real Madrid" away="Sevilla" />);

  fireEvent.click(followButton());

  expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("/login?redirect="));
  expect(service.updatePushPreferences).not.toHaveBeenCalled();
});

it("active l'abonnement pousse et enregistre les deux équipes", async () => {
  render(<FollowMatchButton home="Real Madrid" away="Sevilla" />);

  fireEvent.click(followButton());

  await waitFor(() =>
    expect(service.updatePushPreferences).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: "https://push.example/device",
        followedTeams: ["Real Madrid", "Sevilla"],
        preferences: { matches: true },
      }),
      "token",
    ),
  );
  expect(service.subscribePush).toHaveBeenCalledWith(subscription.toJSON(), "token");
  expect(registration.pushManager.subscribe).toHaveBeenCalledWith(
    expect.objectContaining({ userVisibleOnly: true }),
  );
  await waitFor(() => expect(followButton().getAttribute("aria-pressed")).toBe("true"));
});

it("retire les deux équipes d'un match déjà suivi", async () => {
  service.getPushPreferences.mockResolvedValue({
    success: true,
    data: [{ preferences: { announcements: true, favorites: true, matches: true, subscriptions: true, reminders: true }, followedTeams: ["Real Madrid", "Sevilla", "PSG"] }],
  });
  render(<FollowMatchButton home="Real Madrid" away="Sevilla" />);

  await waitFor(() => expect(followButton().getAttribute("aria-pressed")).toBe("true"));
  fireEvent.click(followButton());

  await waitFor(() =>
    expect(service.updatePushPreferences).toHaveBeenCalledWith(
      expect.objectContaining({ followedTeams: ["PSG"] }),
      "token",
    ),
  );
});

it("n'enregistre rien quand le navigateur refuse les notifications", async () => {
  enablePushApi("denied");
  render(<FollowMatchButton home="Real Madrid" away="Sevilla" />);

  fireEvent.click(followButton());

  await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/autorise les notifications/i));
  expect(service.updatePushPreferences).not.toHaveBeenCalled();
});
