package mmplayer.localcast.tests;

import java.util.HashMap;
import java.util.Map;
import java.util.logging.Logger;

// Compile the actual library method, substituting only Android/HTTP bridge types.
public class LocalCastRequestBridgeTest {
    private static final Logger LOGGER = Logger.getLogger(LocalCastRequestBridgeTest.class.getName());

    private LocalCastRequestBridgeTest() {}

    enum Method { GET, POST }
    static class WritableMap extends HashMap<String, String> {
        void putString(String key, String value) { put(key, value); }
    }
    static class Arguments {
        private Arguments() {}

        static WritableMap createMap() { return new WritableMap(); }
    }
    record IHTTPSession(String uri, String query, Method method, String body) {
        String getUri() { return uri; }
        String getQueryParameterString() { return query; }
        Method getMethod() { return method; }
        void parseBody(Map<String, String> files) {
            if (body != null) files.put("postData", body);
        }
    }

    // NATIVE_REQUEST_METHOD

    private static void check(String path, String query, Method method, String body) throws Exception {
        WritableMap request = new LocalCastRequestBridgeTest().fillRequestMap(new IHTTPSession(path, query, method, body), "request-id");
        String expected = path + (query == null || query.isEmpty() ? "" : "?" + query);
        if (!expected.equals(request.get("url"))) throw new AssertionError("Bridge lost request parameters: " + request.get("url"));
        if (!method.name().equals(request.get("type"))) throw new AssertionError("Incorrect method");
        if (!"request-id".equals(request.get("requestId"))) throw new AssertionError("Incorrect request identity");
        if (body != null && !body.equals(request.get("postData"))) throw new AssertionError("Bridge changed body");
    }

    public static void main(String[] args) throws Exception {
        String report = "report=%7B%22position%22%3A87%2C%22token%22%3A%22session%3A0%22%7D";
        check("/api/state", report + "&sessionId=session&lastCmdId=1", Method.GET, null);
        check("/api/report", "stopped=true&" + report, Method.POST, null);
        check("/api/ended", "token=session%3A0&" + report, Method.POST, null);
        check("/api/seek", "position=87.25", Method.POST, null);
        check("/api/state", null, Method.GET, null);
        check("/api/state", "", Method.GET, null);
        check("/api/report", report, Method.POST, "{\"position\":87}");
        check("/api/state", "file=canci%C3%B3n%20%26%20%2B.mp3&value=%2520", Method.GET, null);
        LOGGER.info("LocalCast native bridge: 8 checks passed");
    }
}
