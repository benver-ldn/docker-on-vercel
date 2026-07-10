package com.example.catalog;

import org.springframework.web.bind.annotation.*;
import java.util.*;
import java.util.stream.Collectors;

@RestController
public class CatalogController {

    record Product(int id, String name, String category, double price, String description) {}

    private static final List<Product> PRODUCTS = List.of(
        new Product(1, "Wireless Headphones", "Electronics", 79.99, "Over-ear Bluetooth headphones with noise cancelling"),
        new Product(2, "Mechanical Keyboard", "Electronics", 119.99, "Hot-swappable RGB mechanical keyboard"),
        new Product(3, "4K Monitor", "Electronics", 329.99, "27-inch 4K UHD IPS monitor"),
        new Product(4, "USB-C Hub", "Electronics", 39.99, "7-in-1 USB-C hub with HDMI and card reader"),
        new Product(5, "Espresso Machine", "Home", 249.99, "15-bar pump espresso machine with milk frother"),
        new Product(6, "Robot Vacuum", "Home", 299.99, "Self-charging robot vacuum with lidar mapping"),
        new Product(7, "Air Purifier", "Home", 149.99, "HEPA air purifier for large rooms"),
        new Product(8, "Standing Desk", "Home", 399.99, "Electric height-adjustable standing desk"),
        new Product(9, "Yoga Mat", "Sports", 29.99, "Non-slip eco-friendly yoga mat"),
        new Product(10, "Dumbbell Set", "Sports", 89.99, "Adjustable dumbbell set 5-25kg"),
        new Product(11, "Running Shoes", "Sports", 109.99, "Lightweight cushioned running shoes"),
        new Product(12, "Water Bottle", "Sports", 19.99, "Insulated stainless steel water bottle")
    );

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "ok", "service", "catalog");
    }

    @GetMapping("/products")
    public List<Product> products(@RequestParam(defaultValue = "") String q,
                                  @RequestParam(required = false) String category) {
        String needle = q.toLowerCase(Locale.ROOT).trim();
        return PRODUCTS.stream()
            .filter(p -> needle.isEmpty()
                || p.name().toLowerCase(Locale.ROOT).contains(needle)
                || p.description().toLowerCase(Locale.ROOT).contains(needle))
            .filter(p -> category == null || category.isBlank()
                || p.category().equalsIgnoreCase(category))
            .collect(Collectors.toList());
    }
}
