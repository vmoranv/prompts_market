import dbConnect from '../lib/dbConnect';
import Notification from '../models/Notification';
import Prompt from '../models/Prompt';
import Comment from '../models/Comment';

export async function cleanupOrphanedNotifications() {
  await dbConnect();
  
  const results = {
    promptNotifications: 0,
    commentNotifications: 0,
    totalCleaned: 0
  };
  
  // 清理指向已删除 Prompt 的通知
  console.log('检查 Prompt 相关通知...');
  const promptNotifications = await Notification.find({
    relatedEntityType: 'Prompt'
  }).select('_id relatedEntity type');
  
  const orphanedPromptNotifications = [];
  for (const notification of promptNotifications) {
    const promptExists = await Prompt.exists({ _id: notification.relatedEntity });
    if (!promptExists) {
      orphanedPromptNotifications.push(notification._id);
      console.log(`发现孤立通知: ${notification._id}, 类型: ${notification.type}, 关联Prompt: ${notification.relatedEntity}`);
    }
  }
  
  if (orphanedPromptNotifications.length > 0) {
    await Notification.deleteMany({
      _id: { $in: orphanedPromptNotifications }
    });
    results.promptNotifications = orphanedPromptNotifications.length;
    console.log(`清理了 ${orphanedPromptNotifications.length} 条孤立的 Prompt 通知`);
  }
  
  // 清理指向已删除 Comment 的通知
  console.log('检查 Comment 相关通知...');
  const commentNotifications = await Notification.find({
    relatedEntityType: 'Comment'
  }).select('_id relatedEntity type');
  
  const orphanedCommentNotifications = [];
  for (const notification of commentNotifications) {
    const commentExists = await Comment.exists({ _id: notification.relatedEntity });
    if (!commentExists) {
      orphanedCommentNotifications.push(notification._id);
      console.log(`发现孤立评论通知: ${notification._id}, 类型: ${notification.type}, 关联Comment: ${notification.relatedEntity}`);
    }
  }
  
  if (orphanedCommentNotifications.length > 0) {
    await Notification.deleteMany({
      _id: { $in: orphanedCommentNotifications }
    });
    results.commentNotifications = orphanedCommentNotifications.length;
    console.log(`清理了 ${orphanedCommentNotifications.length} 条孤立的 Comment 通知`);
  }
  
  results.totalCleaned = results.promptNotifications + results.commentNotifications;
  
  console.log('清理完成:', results);
  return results;
}
