import { LocalizadoModel } from '../models/localizado.model';
import { safeRegexQuery } from '../utils/regex-escape.util';
import { toPublicLocalizado } from '../utils/person-view.util';

export async function getLocalizados(query: Record<string, any>, viewerRole?: string) {
  const q = query.q as string | undefined;
  const location = query.location as string | undefined;
  const maxLimit = query.limit ?? 100;
  const skip = query.offset ?? 0;

  const filter: any = {};

  if (q) {
    const sanitizedQ = safeRegexQuery(q);
    if (sanitizedQ) {
      const searchRegex = new RegExp(sanitizedQ, 'i');
      filter.$or = [
        { name: searchRegex },
        { cedula: searchRegex }
      ];
    }
  }

  if (location) {
    const sanitizedLocation = safeRegexQuery(location);
    if (sanitizedLocation) {
      filter.location = new RegExp(sanitizedLocation, 'i');
    }
  }

  const data = await LocalizadoModel.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(maxLimit)
    .lean();

  const publicData = data.map((d: any) => toPublicLocalizado(d, viewerRole));
  const total = await LocalizadoModel.countDocuments(filter);

  return { data: publicData, total, offset: skip, limit: maxLimit };
}

export async function postLocalizados(data: any[]) {
  const result = await LocalizadoModel.insertMany(data, { ordered: false });
  return result;
}
