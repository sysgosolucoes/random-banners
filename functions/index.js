const API_URL = "https://cliente.sysgo.com.br/banner-api.php";
const CACHE_TTL = 300;

async function getApiData() {
    const cache = caches.default;
    const cacheKey = new Request(API_URL);

    let cached = await cache.match(cacheKey);

    if (cached) {
        const cacheTime = cached.headers.get("x-cache-time");

        if (cacheTime) {
            const age = (Date.now() - new Date(cacheTime).getTime()) / 1000;

            if (age < CACHE_TTL) {
                return cached.json();
            }
        }
    }

    const res = await fetch(API_URL);
    const json = await res.json();

    const response = new Response(JSON.stringify(json), {
        headers: {
            "Content-Type": "application/json",
            "x-cache-time": new Date().toISOString()
        }
    });

    await cache.put(cacheKey, response.clone());

    return json;
}

function isWithinDateRange(ad) {
    const now = new Date();
    const start = new Date(ad.start_date);
    const end = new Date(ad.end_date);
    return now >= start && now <= end;
}

function weightedRandom(items) {
    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
    let random = Math.random() * totalWeight;

    for (const item of items) {
        if (random < item.weight) return item;
        random -= item.weight;
    }
}

export async function onRequest(context) {
    const json = await getApiData();

    const ads = json.data;

    let validAds = ads.filter(ad =>
        ad.active && isWithinDateRange(ad)
    );

    if (validAds.length === 0) {
        return new Response(JSON.stringify({
            error: "Nenhum banner disponível"
        }), { status: 404 });
    }

    const maxPriority = Math.max(...validAds.map(ad => ad.priority));
    validAds = validAds.filter(ad => ad.priority === maxPriority);

    const selected = weightedRandom(validAds);

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
