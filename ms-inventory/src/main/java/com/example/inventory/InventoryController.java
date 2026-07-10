package com.example.inventory;

import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
public class InventoryController {

    // Shared product IDs 1-12. Some zeros to exercise the "out of stock" UI.
    private static final Map<Integer, Integer> STOCK = Map.ofEntries(
        Map.entry(1, 42), Map.entry(2, 0), Map.entry(3, 7), Map.entry(4, 120),
        Map.entry(5, 15), Map.entry(6, 3), Map.entry(7, 0), Map.entry(8, 9),
        Map.entry(9, 230), Map.entry(10, 18), Map.entry(11, 0), Map.entry(12, 512)
    );

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "ok", "service", "inventory");
    }

    @GetMapping("/stock")
    public Map<String, Integer> stock(@RequestParam String ids) {
        Map<String, Integer> out = new LinkedHashMap<>();
        for (String part : ids.split(",")) {
            String t = part.trim();
            if (t.isEmpty()) continue;
            try {
                int id = Integer.parseInt(t);
                if (STOCK.containsKey(id)) out.put(t, STOCK.get(id));
            } catch (NumberFormatException ignored) { }
        }
        return out;
    }
}
