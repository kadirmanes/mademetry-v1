import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";

export function useAuth() {
  const { data: user, isLoading, isError, error } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    
    // --- KRİTİK AYARLAR BURADA ---
    retry: false, // Hata alırsan (401 vb.) ASLA tekrar deneme!
    staleTime: 5 * 60 * 1000, // Veriyi 5 dakika taze tut
    refetchOnWindowFocus: false, // Pencereye dönünce tekrar sorma
    // -----------------------------
  });

  return {
    user: user ?? null, // Hata varsa user null dönsün
    isLoading,
    isError,
    // Kullanıcı verisi varsa VE hata yoksa giriş yapmış say
    isAuthenticated: !!user && !isError, 
  };
}
