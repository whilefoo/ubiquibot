import _sodium from "libsodium-wrappers";
import YAML from "yaml";
import { Payload } from "../types";
import { Context } from "probot";
import {
  getAnalyticsMode,
  getPaymentPermitMaxPrice,
  getBaseMultiplier,
  getCreatorMultiplier,
  getBountyHunterMax,
  getIncentiveMode,
  getNetworkId,
  getPriorityLabels,
  getTimeLabels,
  getDefaultLabels,
  getPromotionComment,
  getIncentives,
  getAssistivePricing,
  getCommandSettings,
  getRegisterWalletWithVerification,
} from "./helpers";

import DEFAULT_CONFIG_JSON from "../../ubiquibot-config-default.json";

const CONFIG_REPO = "ubiquibot-config";
const CONFIG_PATH = ".github/ubiquibot-config.yml";
const KEY_NAME = "private-key-encrypted";
const KEY_PREFIX = "HSK_";

export const getConfigSuperset = async (context: Context, type: "org" | "repo", filePath: string): Promise<string | undefined> => {
  try {
    const payload = context.payload as Payload;
    const repo = type === "org" ? CONFIG_REPO : payload.repository.name;
    const owner = type === "org" ? payload.organization?.login : payload.repository.owner.login;
    if (!repo || !owner) return undefined;
    const { data } = await context.octokit.rest.repos.getContent({
      owner,
      repo,
      path: filePath,
      mediaType: {
        format: "raw",
      },
    });
    return data as unknown as string;
  } catch (error: unknown) {
    return undefined;
  }
};

export interface WideLabel {
  name: string;
}

export interface CommentIncentives {
  elements: Record<string, number>;
  totals: {
    word: number;
  };
}

export interface Incentives {
  comment: CommentIncentives;
}

export interface CommandObj {
  name: string;
  enabled: boolean;
}

export interface WideConfig {
  "evm-network-id"?: number;
  "price-multiplier"?: number;
  "issue-creator-multiplier": number;
  "time-labels"?: WideLabel[];
  "priority-labels"?: WideLabel[];
  "payment-permit-max-price"?: number;
  "command-settings"?: CommandObj[];
  "promotion-comment"?: string;
  "disable-analytics"?: boolean;
  "comment-incentives"?: boolean;
  "assistive-pricing"?: boolean;
  "max-concurrent-assigns"?: number;
  incentives?: Incentives;
  "default-labels"?: string[];
  "register-wallet-with-verification"?: boolean;
}

export type WideRepoConfig = WideConfig;

export interface WideOrgConfig extends WideConfig {
  "private-key-encrypted"?: string;
}

export const parseYAML = (data?: string): WideConfig | undefined => {
  try {
    if (data) {
      const parsedData = YAML.parse(data);
      return parsedData ?? undefined;
    }
    return undefined;
  } catch (error) {
    return undefined;
  }
};

export const getOrgAndRepoFromPath = (path: string) => {
  const parts = path.split("/");

  if (parts.length !== 2) {
    return { org: null, repo: null };
  }

  const [org, repo] = parts;

  return { org, repo };
};

export const getPrivateKey = async (cipherText: string): Promise<string | undefined> => {
  try {
    await _sodium.ready;
    const sodium = _sodium;

    const privateKey = process.env.X25519_PRIVATE_KEY;
    const publicKey = await getScalarKey(privateKey);

    if (!publicKey || !privateKey) {
      return undefined;
    }

    const binPub = sodium.from_base64(publicKey, sodium.base64_variants.URLSAFE_NO_PADDING);
    const binPriv = sodium.from_base64(privateKey, sodium.base64_variants.URLSAFE_NO_PADDING);
    const binCipher = sodium.from_base64(cipherText, sodium.base64_variants.URLSAFE_NO_PADDING);

    let walletPrivateKey: string | undefined = sodium.crypto_box_seal_open(binCipher, binPub, binPriv, "text");
    walletPrivateKey = walletPrivateKey.replace(KEY_PREFIX, "");
    return walletPrivateKey;
  } catch (error: unknown) {
    return undefined;
  }
};

export const getScalarKey = async (X25519_PRIVATE_KEY: string | undefined): Promise<string | undefined> => {
  try {
    if (X25519_PRIVATE_KEY !== undefined) {
      await _sodium.ready;
      const sodium = _sodium;

      const binPriv = sodium.from_base64(X25519_PRIVATE_KEY, sodium.base64_variants.URLSAFE_NO_PADDING);
      const scalerPub = sodium.crypto_scalarmult_base(binPriv, "base64");
      return scalerPub;
    }
    return undefined;
  } catch (error: unknown) {
    return undefined;
  }
};

export const getWideConfig = async (context: Context) => {
  const orgConfig = await getConfigSuperset(context, "org", CONFIG_PATH);
  const repoConfig = await getConfigSuperset(context, "repo", CONFIG_PATH);

  const parsedOrg: WideOrgConfig | undefined = parseYAML(orgConfig);
  const parsedRepo: WideRepoConfig | undefined = parseYAML(repoConfig);
  const parsedDefault: WideRepoConfig = DEFAULT_CONFIG_JSON;
  const privateKeyDecrypted = parsedOrg && parsedOrg[KEY_NAME] ? await getPrivateKey(parsedOrg[KEY_NAME]) : undefined;

  const configs = { parsedRepo, parsedOrg, parsedDefault };
  const configData = {
    networkId: getNetworkId(configs),
    privateKey: privateKeyDecrypted ?? "",
    assistivePricing: getAssistivePricing(configs),
    commandSettings: getCommandSettings(configs),
    baseMultiplier: getBaseMultiplier(configs),
    issueCreatorMultiplier: getCreatorMultiplier(configs),
    timeLabels: getTimeLabels(configs),
    priorityLabels: getPriorityLabels(configs),
    paymentPermitMaxPrice: getPaymentPermitMaxPrice(configs),
    disableAnalytics: getAnalyticsMode(configs),
    bountyHunterMax: getBountyHunterMax(configs),
    incentiveMode: getIncentiveMode(configs),
    incentives: getIncentives(configs),
    defaultLabels: getDefaultLabels(configs),
    promotionComment: getPromotionComment(configs),
    registerWalletWithVerification: getRegisterWalletWithVerification(configs),
  };

  return configData;
};
