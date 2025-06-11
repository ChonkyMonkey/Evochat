const mongoose = require('mongoose');
const { createMethods } = require('@librechat/data-schemas');
const methods = createMethods(mongoose);
const { comparePassword } = require('./userMethods');
const {
  findFileById,
  createFile,
  updateFile,
  deleteFile,
  deleteFiles,
  getFiles,
  updateFileUsage,
} = require('./File');
const {
  getMessage,
  getMessages,
  saveMessage,
  recordMessage,
  updateMessage,
  deleteMessagesSince,
  deleteMessages,
} = require('./Message');
const { getConvoTitle, getConvo, saveConvo, deleteConvos } = require('./Conversation');
const { getPreset, getPresets, savePreset, deletePresets } = require('./Preset');

// Subscription-related imports
const {
  createSubscription,
  getUserSubscription,
  updateSubscription,
  cancelSubscription,
  getSubscriptionStatus,
  hasModelAccess,
  getSubscriptions,
  resetMonthlyQuota,
} = require('./Subscription');

const {
  createPlan,
  getActivePlans,
  getPlanById,
  getPlanByName,
  getPlanByPaddleId,
  updatePlan,
  deactivatePlan,
  seedDefaultPlans,
  getPlansForComparison,
  isModelAllowedForPlan,
  getModelsForPlan,
} = require('./Plan');

const {
  recordUsage,
  getMonthlyUsage,
  getWeeklyUsage,
  getUserUsageHistory,
  getDailyUsage,
  checkWeeklyWarning,
  getTopModelsByUsage,
  cleanupOldRecords,
} = require('./UsageRecord');

module.exports = {
  ...methods,
  comparePassword,
  findFileById,
  createFile,
  updateFile,
  deleteFile,
  deleteFiles,
  getFiles,
  updateFileUsage,

  getMessage,
  getMessages,
  saveMessage,
  recordMessage,
  updateMessage,
  deleteMessagesSince,
  deleteMessages,

  getConvoTitle,
  getConvo,
  saveConvo,
  deleteConvos,

  getPreset,
  getPresets,
  savePreset,
  deletePresets,

  // Subscription methods
  createSubscription,
  getUserSubscription,
  updateSubscription,
  cancelSubscription,
  getSubscriptionStatus,
  hasModelAccess,
  getSubscriptions,
  resetMonthlyQuota,

  // Plan methods
  createPlan,
  getActivePlans,
  getPlanById,
  getPlanByName,
  getPlanByPaddleId,
  updatePlan,
  deactivatePlan,
  seedDefaultPlans,
  getPlansForComparison,
  isModelAllowedForPlan,
  getModelsForPlan,

  // Usage tracking methods
  recordUsage,
  getMonthlyUsage,
  getWeeklyUsage,
  getUserUsageHistory,
  getDailyUsage,
  checkWeeklyWarning,
  getTopModelsByUsage,
  cleanupOldRecords,
};
