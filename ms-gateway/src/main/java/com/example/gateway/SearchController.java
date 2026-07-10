package com.example.gateway;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import java.util.stream.Collectors;

@RestController
public class SearchController {

    record Product(int id, String name, String category, double price, String description) {}
    record Rating(double avg, int count) {}
    record Enriched(int id, String name, String category, double price, String description,
                    Integer stock, Rating rating) {}

    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5)).build();
    private final ObjectMapper mapper;
    private final String catalogUrl;
    private final String inventoryUrl;
    private final String reviewsUrl;

    public SearchController(ObjectMapper mapper,
                            @Value("${services.catalog-url}") String catalogUrl,
                            @Value("${services.inventory-url}") String inventoryUrl,
                            @Value("${services.reviews-url}") String reviewsUrl) {
        this.mapper = mapper;
        this.catalogUrl = catalogUrl;
        this.inventoryUrl = inventoryUrl;
        this.reviewsUrl = reviewsUrl;
    }

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "ok", "service", "gateway");
    }

    @GetMapping("/api/search")
    public List<Enriched> search(@RequestParam(defaultValue = "") String q,
                                 @RequestParam(required = false) String category) throws Exception {
        // 1) catalog is REQUIRED — failure propagates as a 500.
        String query = "q=" + enc(q) + (category != null ? "&category=" + enc(category) : "");
        String catalogBody = get(catalogUrl + "/products?" + query, Duration.ofSeconds(10));
        List<Product> products = Arrays.asList(mapper.readValue(catalogBody, Product[].class));
        if (products.isEmpty()) return List.of();

        String ids = products.stream().map(p -> String.valueOf(p.id()))
                .collect(Collectors.joining(","));

        // 2) inventory + reviews are BEST-EFFORT — fall back to empty maps.
        Map<String, Integer> stock = getStock(ids);
        Map<String, Rating> ratings = getRatings(ids);

        // 3) merge on id; missing downstream data becomes null.
        List<Enriched> out = new ArrayList<>();
        for (Product p : products) {
            String key = String.valueOf(p.id());
            out.add(new Enriched(p.id(), p.name(), p.category(), p.price(), p.description(),
                    stock.get(key), ratings.get(key)));
        }
        return out;
    }

    private Map<String, Integer> getStock(String ids) {
        try {
            String body = get(inventoryUrl + "/stock?ids=" + ids, Duration.ofSeconds(10));
            return mapper.readValue(body, mapper.getTypeFactory()
                    .constructMapType(HashMap.class, String.class, Integer.class));
        } catch (Exception e) {
            return Map.of();
        }
    }

    private Map<String, Rating> getRatings(String ids) {
        try {
            String body = get(reviewsUrl + "/ratings?ids=" + ids, Duration.ofSeconds(10));
            return mapper.readValue(body, mapper.getTypeFactory()
                    .constructMapType(HashMap.class, String.class, Rating.class));
        } catch (Exception e) {
            return Map.of();
        }
    }

    private String get(String url, Duration timeout) throws Exception {
        HttpRequest req = HttpRequest.newBuilder(URI.create(url)).timeout(timeout).GET().build();
        HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
        if (resp.statusCode() / 100 != 2) {
            throw new RuntimeException("downstream " + url + " -> " + resp.statusCode());
        }
        return resp.body();
    }

    private static String enc(String s) {
        return URLEncoder.encode(s == null ? "" : s, StandardCharsets.UTF_8);
    }
}
