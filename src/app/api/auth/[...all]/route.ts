import { getAuth } from '@/lib/auth'

// Better Auth atiende /api/auth/* (login, logout, recuperación) y aplica su propio rate limit.
const handler = (request: Request) => getAuth().handler(request)

export { handler as GET, handler as POST }
