import 'server-only';
import {getCurrentUser} from '@/lib/auth';
import {canAccessCoachingPreview} from './preview';
export async function canViewCoachingPreview(){return canAccessCoachingPreview(await getCurrentUser());}
