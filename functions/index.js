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
    const request = context.request;

    const apiRes = await fetch("https://cliente.sysgo.com.br/banner-api.php");
    const json = await apiRes.json();

    const version = json.version;
    const ads = json.data;

    const cache = caches.default;
    const cacheKey = new Request(request.url + "?v=" + version);

    let response = await cache.match(cacheKey);
    if (response) {
        return response;
    }

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

    const result = {
        image: selected.image,
        url: selected.url
    };

    const finalResponse = new Response(JSON.stringify(result), {
        headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=2592000"
        }
    });

    context.waitUntil(cache.put(cacheKey, finalResponse.clone()));

    return finalResponse;
}
