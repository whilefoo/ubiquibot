import { getBotConfig, getBotContext } from "../../bindings";
import { addLabelToIssue, clearAllPriceLabelsOnIssue } from "../../helpers";
import { Payload } from "../../types";
import { getTargetPriceLabel } from "../shared";

export const pricingLabelLogic = async (): Promise<void> => {
  const context = getBotContext();
  const config = getBotConfig();
  const { log } = context;
  const payload = context.payload as Payload;
  if (!payload.issue) return;
  const labels = payload.issue.labels;

  const timeLabels = config.price.timeLabels.filter((item) => labels.map((i) => i.name).includes(item.name));
  const priorityLabels = config.price.priorityLabels.filter((item) => labels.map((i) => i.name).includes(item.name));

  const minTimeLabel = timeLabels.length > 0 ? timeLabels.reduce((a, b) => (a.weight < b.weight ? a : b)).name : undefined;
  const minPriorityLabel = priorityLabels.length > 0 ? priorityLabels.reduce((a, b) => (a.weight < b.weight ? a : b)).name : undefined;

  const targetPriceLabel = getTargetPriceLabel(minTimeLabel, minPriorityLabel);
  if (targetPriceLabel) {
    if (labels.map((i) => i.name).includes(targetPriceLabel)) {
      log.info({ labels, timeLabels, priorityLabels, targetPriceLabel }, `Skipping... already exists`);
    } else {
      log.info({ labels, timeLabels, priorityLabels, targetPriceLabel }, `Adding price label to issue`);
      await clearAllPriceLabelsOnIssue();
      await addLabelToIssue(targetPriceLabel);
    }
  } else {
    await clearAllPriceLabelsOnIssue();
    log.info({ labels, timeLabels, priorityLabels, targetPriceLabel }, `Skipping action...`);
  }
};
