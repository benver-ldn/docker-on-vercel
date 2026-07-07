package com.example.demo;

import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HelloController {

    // GET / — proves a real JVM booted by reporting the live Java version.
    @GetMapping("/")
    public Map<String, Object> index() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", "ok");
        body.put("runtime", "spring-boot");
        body.put("javaVersion", System.getProperty("java.version"));
        body.put("message", "Hello from Spring Boot on Vercel");
        return body;
    }

    // POST /echo — echoes back whatever JSON was sent (object, array, scalar, or empty).
    @PostMapping("/echo")
    public Map<String, Object> echo(@RequestBody(required = false) Object received) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("ok", true);
        body.put("received", received);
        return body;
    }
}
