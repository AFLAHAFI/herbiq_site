import { publicBackend } from './backend';
import { replacePublicCatalog } from '../data/plants';
import rawPlantsData from '../data/herbiq-plants.json';
import {
  loadOfflineCatalog,
  markUsingOfflineCatalog,
  saveOfflineCatalog,
} from './offline-sync';
import type { Plant, PlantTranslations } from '../types';

let sequence = 0;

const LOCAL_TRANSLATION_DEFAULTS = new Map<string, PlantTranslations>(
  (rawPlantsData as Plant[])
    .filter((p) => p.translations && Object.keys(p.translations).length > 0)
    .map((p) => [p.id, p.translations!])
);

// Include the 28th live Supabase plant ('adalodakam-1' / Vasaka) reviewed Arabic draft fallback
LOCAL_TRANSLATION_DEFAULTS.set('adalodakam-1', {
  ar: {
    name: 'فاساكا / أدالوداكام (جوز ملابار)',
    category: 'شجيرة',
    description:
      'أدالوداكام (فاساكا) شجيرة دائمة الخضرة شائعة في الحدائق المنزلية والأسوار النباتية في كيرالا، وهي من أشهر النباتات في الأيورفيدا والممارسات المنزلية التقليدية في كيرالا.',
    traditionalUses:
      'يُستخدم تقليدياً في محضرات الأيورفيدا المرتبطة براحة الجهاز التنفسي، وخاصة العناية بالسعال والحلق.',
    medicinalBenefits: 'يرتبط تقليدياً بمحضرات الأيورفيدا الداعمة لراحة الجهاز التنفسي والعناية بالحلق.',
    plantPartsTraditionallyUsed: 'الأوراق والأزهار والجذور.',
    traditionalUsage: 'تُستخدم الأوراق تقليدياً في المغليات والمحضرات العشبية المنزلية.',
    habitat: 'المناطق الاستوائية وشبه الاستوائية في الهند؛ ينمو جيداً في حدائق كيرالا وجوانب الطرق والأسوار.',
    identification: 'شجيرة دائمة الخضرة ذات أوراق رمحية عريضة وأزهار بيضاء ثنائية الشفة.',
    culturalImportance: 'نبات تقليدي معروف في الحدائق المنزلية وتراث الأيورفيدا في كيرالا.',
    uses: ['دعم راحة الجهاز التنفسي والحلق تقليدياً', 'المحضرات العشبية المنزلية في كيرالا'],
    health: {
      issues: 'حشرات المن والبق الدقيقي وتبقع الأوراق خلال الأمطار الغزيرة.',
      symptoms: 'التفاف الأوراق أو لزوجتها، أو ظهور بقع بنية أو اصفرار.',
      prevention: 'تصريف جيد للمياه، وإضاءة شمسية كافية، وتقليم منتظم وإزالة الأوراق المصابة.',
    },
  },
  ml: {
    name: 'ആടലോടകം',
  },
});

function mergePlantRow(row: { profile: Plant; translations?: PlantTranslations | null }): Plant {
  const profile = row.profile;
  const fallbackTranslations = LOCAL_TRANSLATION_DEFAULTS.get(profile.id) || {};
  const colTranslations = row.translations && typeof row.translations === 'object' ? row.translations : undefined;
  const mergedTranslations: PlantTranslations = {
    ...fallbackTranslations,
    ...(profile.translations || {}),
    ...(colTranslations || {}),
  };
  return Object.keys(mergedTranslations).length > 0
    ? { ...profile, translations: mergedTranslations }
    : profile;
}

export async function refreshCatalog() {
  if (!publicBackend) return;
  const ticket = ++sequence;

  try {
    let { data, error } = await publicBackend
      .from('herbiq_plants')
      .select('profile, translations')
      .eq('published', true)
      .order('id')
      .abortSignal(AbortSignal.timeout(15000));

    // Fallback if migration 003_i18n has not yet been applied on the remote database
    if (error && String(error.message || '').includes('translations')) {
      const fallback = await publicBackend
        .from('herbiq_plants')
        .select('profile')
        .eq('published', true)
        .order('id')
        .abortSignal(AbortSignal.timeout(15000));
      data = fallback.data as any;
      error = fallback.error;
    }

    if (ticket !== sequence) return;
    if (error) {
      throw error;
    }

    const merged = (data || []).map((row: any) => mergePlantRow(row));
    replacePublicCatalog(merged);
    saveOfflineCatalog(merged);
  } catch (err) {
    if (ticket !== sequence) return;
    // If the device is offline and we have a saved offline catalog, serve it seamlessly!
    const isBrowserOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
    const cached = loadOfflineCatalog();
    if (isBrowserOffline && cached && cached.plants.length > 0) {
      replacePublicCatalog(cached.plants);
      markUsingOfflineCatalog(cached.plants, cached.updatedAt);
      return;
    }
    replacePublicCatalog([]);
    throw err;
  }
}
