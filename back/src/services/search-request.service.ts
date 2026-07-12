import { SearchRequestModel, ISearchRequest } from '../models/search-request.model';
import { personMatchingQueue } from '../queues/person-matching.queue';

interface CreateSearchRequestData {
  user: string;
  searchName: string;
  description?: string;
  category?: 'menor' | 'adulto' | 'adulto_mayor' | 'mascota';
  isMinor?: boolean;
}

export async function createSearchRequest(data: CreateSearchRequestData): Promise<ISearchRequest> {
  const newRequest = await SearchRequestModel.create(data);

  await personMatchingQueue.enqueue({ idHash: newRequest._id.toString(), source: 'search-request' });

  return newRequest as ISearchRequest;
}

export async function getMySearchRequests(userId: string) {
  return SearchRequestModel.find({ user: userId }).sort({ createdAt: -1 }).lean();
}

export async function updateSearchRequestStatus(id: string, userId: string, status: string) {
  const request = await SearchRequestModel.findOneAndUpdate(
    { _id: id, user: userId },
    { status },
    { new: true }
  );
  return request;
}
