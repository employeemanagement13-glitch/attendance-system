import { supabase } from './supabase';
import { auth, currentUser } from '@clerk/nextjs/server';

export type UserRole = 'admin' | 'instructor' | 'student';

export async function getUserRole(email: string): Promise<UserRole | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('role')
      .eq('email', email)
      .single();

    if (error || !data) {
      console.error('Error fetching user role:', error);
      return null;
    }

    return data.role as UserRole;
  } catch (err) {
    console.error('Unexpected error fetching role:', err);
    return null;
  }
}

export async function getCurrentUserRole(): Promise<UserRole | null> {
  const user = await currentUser();
  if (!user || !user.emailAddresses[0]) return null;

  const email = user.emailAddresses[0].emailAddress;
  return getUserRole(email);
}

export async function isUserAuthorized(email: string): Promise<boolean> {
   const role = await getUserRole(email);
   return !!role; 
}
