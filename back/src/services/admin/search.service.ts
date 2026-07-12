import { SearchRequestModel } from '../../models/search-request.model';

export async function getAdminSearches(limit: number, offset: number) {
  const [searches, total] = await Promise.all([
    SearchRequestModel.find({})
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit),
    SearchRequestModel.countDocuments({}),
  ]);
  return { total, limit, offset, searches };
}
