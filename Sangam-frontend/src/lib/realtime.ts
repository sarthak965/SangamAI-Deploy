import { Centrifuge, type Subscription } from "centrifuge";
import { api } from "./api";

type PublicationHandler<T> = (data: T) => void;

class RealtimeManager {
  private client: Centrifuge | null = null;
  private token: string | null = null;
  private connectionPromise: Promise<Centrifuge> | null = null;

  async connect(authToken: string): Promise<Centrifuge> {
    if (this.client && this.token === authToken) {
      return this.client;
    }

    if (this.connectionPromise && this.token === authToken) {
      return this.connectionPromise;
    }

    this.token = authToken;
    this.connectionPromise = api.getCentrifugoToken(authToken).then(({ token, wsUrl }) => {
      this.client = new Centrifuge(wsUrl, { token });
      this.client.connect();
      return this.client;
    });

    return this.connectionPromise;
  }

  async subscribe<T>(
    authToken: string,
    channel: string,
    onPublication: PublicationHandler<T>,
  ): Promise<() => void> {
    const client = await this.connect(authToken);

    const subscription: Subscription =
      client.getSubscription(channel) ??
      client.newSubscription(channel, {
        getToken: async () => {
          const { token } = await api.getSubscriptionToken(authToken, channel);
          return token;
        },
      });

    subscription.on("publication", (ctx) => {
      onPublication(ctx.data as T);
    });

    subscription.subscribe();

    return () => {
      subscription.unsubscribe();
      subscription.removeAllListeners();
    };
  }

  disconnect() {
    this.client?.disconnect();
    this.client = null;
    this.connectionPromise = null;
    this.token = null;
  }
}

export const realtimeManager = new RealtimeManager();
