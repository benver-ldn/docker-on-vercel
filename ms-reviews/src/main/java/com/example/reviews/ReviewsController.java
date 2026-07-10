package com.example.reviews;

import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
public class ReviewsController {

    record Rating(double avg, int count) {}

    // Shared product IDs 1-12.
    private static final Map<Integer, Rating> RATINGS = Map.ofEntries(
        Map.entry(1, new Rating(4.5, 128)), Map.entry(2, new Rating(4.7, 342)),
        Map.entry(3, new Rating(4.2, 89)),  Map.entry(4, new Rating(4.0, 54)),
        Map.entry(5, new Rating(4.6, 210)), Map.entry(6, new Rating(3.9, 76)),
        Map.entry(7, new Rating(4.3, 41)),  Map.entry(8, new Rating(4.8, 165)),
        Map.entry(9, new Rating(4.1, 300)), Map.entry(10, new Rating(4.4, 98)),
        Map.entry(11, new Rating(4.5, 512)),Map.entry(12, new Rating(4.9, 77))
    );

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "ok", "service", "reviews");
    }

    @GetMapping("/ratings")
    public Map<String, Rating> ratings(@RequestParam String ids) {
        Map<String, Rating> out = new LinkedHashMap<>();
        for (String part : ids.split(",")) {
            String t = part.trim();
            if (t.isEmpty()) continue;
            try {
                int id = Integer.parseInt(t);
                if (RATINGS.containsKey(id)) out.put(t, RATINGS.get(id));
            } catch (NumberFormatException ignored) { }
        }
        return out;
    }
}
