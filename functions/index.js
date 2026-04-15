const API_URL = "https://cliente.sysgo.com.br/banner-api.php";
const CACHE_TTL = 300;

const FALLBACK = {
    image: "https://banners.sysgo.com.br/images/imagem1.png",
    url: "https://www.instagram.com/sysgosolucoes/",
    weight: 1,
    priority: 1
};

async function getApiData() {
    const cache = caches.default;
    const cacheKey = new Request(API_URL);

    try {
        let cached = await cache.match(cacheKey);

        if (cached) {
            const cacheTime = cached.headers.get("x-cache-time");

            if (cacheTime) {
                const age = (Date.now() - new Date(cacheTime).getTime()) / 1000;

                if (age < CACHE_TTL) {
                    return await cached.json();
                }
            }
        }

        const res = await fetch(API_URL);

        if (!res.ok) {
            throw new Error("API respondeu com erro");
        }

        const json = await res.json();

        const response = new Response(JSON.stringify(json), {
            headers: {
                "Content-Type": "application/json",
                "x-cache-time": new Date().toISOString()
            }
        });

        await cache.put(cacheKey, response.clone());

        return json;

    } catch (error) {
        let cached = await cache.match(cacheKey);

        if (cached) {
            return await cached.json();
        }

        return {
            data: [FALLBACK]
        };
    }
}

function isWithinDateRange(ad) {
    const now = new Date();

    const start = ad.start_date
        ? new Date(ad.start_date + "T00:00:00")
        : new Date("2000-01-01T00:00:00");

    const end = ad.end_date
        ? new Date(ad.end_date + "T23:59:59.999")
        : new Date("3000-01-01T23:59:59.999");

    return now >= start && now <= end;
}

function normalizeWeight(value) {
    if (value === undefined || value === null || value === "") return 1;

    const weight = Number(value);

    if (!Number.isFinite(weight)) return 1;

    return Math.max(1, weight);
}

function isActive(ad) {
    const v = ad.active;

    if (v === undefined || v === null) return true;
    if (v === false || v === 0) return false;

    if (typeof v === "string") {
        const s = v.trim().toLowerCase();
        if (s === "0" || s === "false" || s === "no") return false;
    }

    return Boolean(v);
}

function normalizePriority(value) {
    const priority = Number(value);
    return Number.isFinite(priority) ? priority : 1;
}

function weightedRandom(items) {
    const totalWeight = items.reduce((sum, item) => {
        return sum + normalizeWeight(item.weight);
    }, 0);

    if (totalWeight <= 0) return items[0];

    let random = Math.random() * totalWeight;

    for (const item of items) {
        const weight = normalizeWeight(item.weight);

        if (random < weight) return item;
        random -= weight;
    }

    return items[0];
}

export async function onRequest(context) {
    const json = await getApiData();

    let ads = Array.isArray(json.data) ? json.data : [];

    ads = ads.filter(ad => ad && ad.image && ad.url);

    let validAds = ads.filter(ad =>
        isActive(ad) &&
        isWithinDateRange(ad)
    );

    if (validAds.length === 0) {
        validAds = [FALLBACK];
    }

    validAds = validAds.map(ad => ({
        ...ad,
        _priority: normalizePriority(ad.priority)
    }));

    const priorities = validAds.map(ad => ad._priority);
    const maxPriority = priorities.length ? Math.max(...priorities) : 1;

    validAds = validAds.filter(ad => ad._priority === maxPriority);

    const selected = weightedRandom(validAds) || FALLBACK;

    return new Response(JSON.stringify({
        image: selected.image,
        url: selected.url
    }), {
        headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store"
        }
    });
}
