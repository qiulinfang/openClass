package com.cosinetech.imates.textbookservice;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.security.MessageDigest;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

public class LearnResourceManager {
    private static final String TAG = "LearnResourceManager";
    private static final String BASE_URL = "https://43.138.16.5:50013"; // Replace with actual domain
    private static final String PREF_NAME = "LearnResourceManager";
    private static final String KEY_TOKEN = "token";
    private static final String KEY_USER_ID = "userId";
    
    private final Context context;
    private final OkHttpClient httpClient;
    private final Gson gson;
    private final SharedPreferences preferences;
    private final Handler mainHandler;
    private final ExecutorService executorService;
    private final SimpleDateFormat dateFormat;
    
    private String currentToken;
    private String currentUserId;
    
    public LearnResourceManager(Context context) {
        this.context = context.getApplicationContext();
        this.httpClient = new OkHttpClient.Builder()
                .connectTimeout(30, TimeUnit.SECONDS)
                .readTimeout(60, TimeUnit.SECONDS)
                .writeTimeout(60, TimeUnit.SECONDS)
                .build();
        this.gson = new GsonBuilder()
                .setDateFormat("yyyy-MM-dd HH:mm:ss")
                .create();
        this.preferences = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        this.mainHandler = new Handler(Looper.getMainLooper());
        this.executorService = Executors.newFixedThreadPool(4);
        this.dateFormat = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault());
        
        // Load saved credentials
        loadCredentials();
    }
    
    // ==================== Authentication ====================
    
    public interface LoginCallback {
        void onSuccess(LoginResponse response);
        void onError(String error);
    }
    
    public void login(String account, String password, LoginCallback callback) {
        try {
            String md5Password = md5(password);
            LoginRequest request = new LoginRequest(account, md5Password);
            String json = gson.toJson(request);
            
            RequestBody body = RequestBody.create(json, MediaType.get("application/json"));
            Request httpRequest = new Request.Builder()
                    .url(BASE_URL + "/blw-edu-yb/auth/login-student")
                    .post(body)
                    .build();
            
            httpClient.newCall(httpRequest).enqueue(new Callback() {
                @Override
                public void onFailure(Call call, IOException e) {
                    mainHandler.post(() -> callback.onError("Network error: " + e.getMessage()));
                }
                
                @Override
                public void onResponse(Call call, Response response) {
                    try {
                        String responseBody = response.body().string();
                        ApiResponse<LoginData> apiResponse = gson.fromJson(responseBody, 
                                new TypeToken<ApiResponse<LoginData>>(){}.getType());
                        
                        if (apiResponse.success && apiResponse.data != null) {
                            currentToken = apiResponse.data.token;
                            currentUserId = apiResponse.data.userId;
                            saveCredentials();
                            
                            LoginResponse loginResponse = new LoginResponse(
                                    apiResponse.data.token,
                                    apiResponse.data.userId,
                                    apiResponse.data.defaultPassword
                            );
                            
                            mainHandler.post(() -> callback.onSuccess(loginResponse));
                        } else {
                            mainHandler.post(() -> callback.onError(apiResponse.message));
                        }
                    } catch (Exception e) {
                        mainHandler.post(() -> callback.onError("Parse error: " + e.getMessage()));
                    }
                }
            });
        } catch (Exception e) {
            callback.onError("Request error: " + e.getMessage());
        }
    }
    
    private void saveCredentials() {
        preferences.edit()
                .putString(KEY_TOKEN, currentToken)
                .putString(KEY_USER_ID, currentUserId)
                .apply();
    }
    
    private void loadCredentials() {
        currentToken = preferences.getString(KEY_TOKEN, null);
        currentUserId = preferences.getString(KEY_USER_ID, null);
    }
    
    public boolean isLoggedIn() {
        return currentToken != null && !currentToken.isEmpty();
    }
    
    public void logout() {
        currentToken = null;
        currentUserId = null;
        preferences.edit().clear().apply();
    }
    
    // ==================== Textbook APIs ====================
    
    public interface TextbookVersionsCallback {
        void onSuccess(List<TextbookVersion> versions);
        void onError(String error);
        void onUnauthorized(); // For 401 handling
    }
    
    public void getTextbookVersions(TextbookVersionsCallback callback) {
        if (!isLoggedIn()) {
            callback.onError("Not logged in");
            return;
        }
        
        Request request = new Request.Builder()
                .url(BASE_URL + "/blw-edu-yb/api/app/teacher-textbook")
                .post(RequestBody.create("", MediaType.get("application/json")))
                .addHeader("sa-token", currentToken)
                .build();
        
        httpClient.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                mainHandler.post(() -> callback.onError("Network error: " + e.getMessage()));
            }
            
            @Override
            public void onResponse(Call call, Response response) {
                if (response.code() == 401) {
                    mainHandler.post(callback::onUnauthorized);
                    return;
                }
                
                try {
                    String responseBody = response.body().string();
                    ApiResponse<List<TextbookVersion>> apiResponse = gson.fromJson(responseBody,
                            new TypeToken<ApiResponse<List<TextbookVersion>>>(){}.getType());
                    
                    if (apiResponse.success && apiResponse.data != null) {
                        mainHandler.post(() -> callback.onSuccess(apiResponse.data));
                    } else {
                        mainHandler.post(() -> callback.onError(apiResponse.message));
                    }
                } catch (Exception e) {
                    mainHandler.post(() -> callback.onError("Parse error: " + e.getMessage()));
                }
            }
        });
    }
    
    public interface TextbookStructureCallback {
        void onSuccess(List<ChapterNode> structure);
        void onError(String error);
        void onUnauthorized();
    }
    
    public void getTextbookStructure(String textbookId, TextbookStructureCallback callback) {
        if (!isLoggedIn()) {
            callback.onError("Not logged in");
            return;
        }
        
        TextbookStructureRequest request = new TextbookStructureRequest(textbookId);
        String json = gson.toJson(request);
        
        RequestBody body = RequestBody.create(json, MediaType.get("application/json"));
        Request httpRequest = new Request.Builder()
                .url(BASE_URL + "/blw-edu-yb/api/app/teacher-textbook-section-tree")
                .post(body)
                .addHeader("sa-token", currentToken)
                .build();
        
        httpClient.newCall(httpRequest).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                mainHandler.post(() -> callback.onError("Network error: " + e.getMessage()));
            }
            
            @Override
            public void onResponse(Call call, Response response) {
                if (response.code() == 401) {
                    mainHandler.post(callback::onUnauthorized);
                    return;
                }
                
                try {
                    String responseBody = response.body().string();
                    ApiResponse<List<ChapterNode>> apiResponse = gson.fromJson(responseBody,
                            new TypeToken<ApiResponse<List<ChapterNode>>>(){}.getType());
                    
                    if (apiResponse.success && apiResponse.data != null) {
                        mainHandler.post(() -> callback.onSuccess(apiResponse.data));
                    } else {
                        mainHandler.post(() -> callback.onError(apiResponse.message));
                    }
                } catch (Exception e) {
                    mainHandler.post(() -> callback.onError("Parse error: " + e.getMessage()));
                }
            }
        });
    }
    
    public interface LearningPackageCallback {
        void onSuccess(List<LearningPackage> resources);
        void onError(String error);
        void onUnauthorized();
    }
    
    public void getLearningPackage(String textbookVersionId, LearningPackageCallback callback) {
        if (!isLoggedIn()) {
            callback.onError("Not logged in");
            return;
        }
        
        LearningResourcesRequest request = new LearningResourcesRequest(textbookVersionId);
        String json = gson.toJson(request);
        
        RequestBody body = RequestBody.create(json, MediaType.get("application/json"));
        Request httpRequest = new Request.Builder()
                .url(BASE_URL + "/blw-edu-yb/api/app/teacher-textbook-learning-package")
                .post(body)
                .addHeader("sa-token", currentToken)
                .build();
        
        httpClient.newCall(httpRequest).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                mainHandler.post(() -> callback.onError("Network error: " + e.getMessage()));
            }
            
            @Override
            public void onResponse(Call call, Response response) {
                if (response.code() == 401) {
                    mainHandler.post(callback::onUnauthorized);
                    return;
                }
                
                try {
                    String responseBody = response.body().string();
                    ApiResponse<List<LearningPackage>> apiResponse = gson.fromJson(responseBody,
                            new TypeToken<ApiResponse<List<LearningPackage>>>(){}.getType());
                    
                    if (apiResponse.success && apiResponse.data != null) {
                        mainHandler.post(() -> callback.onSuccess(apiResponse.data));
                    } else {
                        mainHandler.post(() -> callback.onError(apiResponse.message));
                    }
                } catch (Exception e) {
                    mainHandler.post(() -> callback.onError("Parse error: " + e.getMessage()));
                }
            }
        });
    }
    
    // ==================== Update Detection ====================
    
    public interface UpdateCheckCallback {
        void onUpdateAvailable(List<TextbookVersion> updatedTextbooks);
        void onNoUpdates();
        void onError(String error);
    }
    
    public void checkForUpdates(UpdateCheckCallback callback) {
        getTextbookVersions(new TextbookVersionsCallback() {
            @Override
            public void onSuccess(List<TextbookVersion> versions) {
                executorService.execute(() -> {
                    try {
                        List<TextbookVersion> updatedTextbooks = new ArrayList<>();
                        
                        for (TextbookVersion version : versions) {
                            String lastUpdateTime = getLastUpdateTime(version.id);
                            if (lastUpdateTime == null || isNewer(version.textbookUpdateTime, lastUpdateTime)) {
                                updatedTextbooks.add(version);
                            }
                        }
                        
                        mainHandler.post(() -> {
                            if (updatedTextbooks.isEmpty()) {
                                callback.onNoUpdates();
                            } else {
                                callback.onUpdateAvailable(updatedTextbooks);
                            }
                        });
                    } catch (Exception e) {
                        mainHandler.post(() -> callback.onError("Update check error: " + e.getMessage()));
                    }
                });
            }
            
            @Override
            public void onError(String error) {
                callback.onError(error);
            }
            
            @Override
            public void onUnauthorized() {
                callback.onError("Authentication required");
            }
        });
    }
    
    private boolean isNewer(String newTime, String oldTime) {
        try {
            Date newDate = dateFormat.parse(newTime);
            Date oldDate = dateFormat.parse(oldTime);
            return newDate.after(oldDate);
        } catch (ParseException e) {
            Log.e(TAG, "Date parse error", e);
            return true; // Assume newer if can't parse
        }
    }
    
    // ==================== File Download ====================
    
    public interface DownloadProgressCallback {
        void onProgress(String fileName, long downloadedBytes, long totalBytes, int percentage);
        void onFileCompleted(String fileName, String localPath);
        void onAllCompleted();
        void onError(String fileName, String error);
    }
    
    public void downloadAllResources(TextbookVersion textbook, DownloadProgressCallback callback) {
        getLearningPackage(textbook.id, new LearningPackageCallback() {
            @Override
            public void onSuccess(List<LearningPackage> resources) {
                executorService.execute(() -> downloadResourcesInBackground(textbook, resources, callback));
            }
            
            @Override
            public void onError(String error) {
                callback.onError("", "Failed to get resources: " + error);
            }
            
            @Override
            public void onUnauthorized() {
                callback.onError("", "Authentication required");
            }
        });
    }
    
    private void downloadResourcesInBackground(TextbookVersion textbook, List<LearningPackage> packages, DownloadProgressCallback callback) {
        try {
            // Create directory structure
            File textbookDir = createTextbookDirectory(textbook);
            
            // Create resource index
            ResourceIndex index = new ResourceIndex();
            index.textbook = textbook;
            index.packages = packages;
            index.downloadTime = dateFormat.format(new Date());
            
            int totalFiles = 0;
            for (LearningPackage pkg : packages) {
                totalFiles += pkg.resourceList.size();
            }
            
            int completedFiles = 0;
            
            for (LearningPackage pkg : packages) {
                File packageDir = new File(textbookDir, sanitizeFileName(pkg.packageName));
                packageDir.mkdirs();
                
                for (ResourceFile resource : pkg.resourceList) {
                    try {
                        File localFile = new File(packageDir, resource.fileName);
                        
                        // Check if file exists and has correct checksum
                        if (localFile.exists() && verifyChecksum(localFile, resource.checksum)) {
                            completedFiles++;
                            mainHandler.post(() -> callback.onFileCompleted(resource.fileName, localFile.getAbsolutePath()));
                            continue;
                        }
                        
                        // Download file
                        downloadFile(resource, localFile, new SingleFileDownloadCallback() {
                            @Override
                            public void onProgress(long downloadedBytes, long totalBytes, int percentage) {
                                mainHandler.post(() -> callback.onProgress(resource.fileName, downloadedBytes, totalBytes, percentage));
                            }
                            
                            @Override
                            public void onCompleted(String localPath) {
                                mainHandler.post(() -> callback.onFileCompleted(resource.fileName, localPath));
                            }
                            
                            @Override
                            public void onError(String error) {
                                mainHandler.post(() -> callback.onError(resource.fileName, error));
                            }
                        });
                        
                        completedFiles++;
                        
                    } catch (Exception e) {
                        Log.e(TAG, "Error downloading file: " + resource.fileName, e);
                        mainHandler.post(() -> callback.onError(resource.fileName, e.getMessage()));
                    }
                }
            }
            
            // Save resource index
            saveResourceIndex(textbookDir, index);
            
            // Update last update time
            saveLastUpdateTime(textbook.id, textbook.textbookUpdateTime);
            
            mainHandler.post(callback::onAllCompleted);
            
        } catch (Exception e) {
            Log.e(TAG, "Error in downloadResourcesInBackground", e);
            mainHandler.post(() -> callback.onError("", "Download error: " + e.getMessage()));
        }
    }
    
    private interface SingleFileDownloadCallback {
        void onProgress(long downloadedBytes, long totalBytes, int percentage);
        void onCompleted(String localPath);
        void onError(String error);
    }
    
    private void downloadFile(ResourceFile resource, File localFile, SingleFileDownloadCallback callback) {
        Request request = new Request.Builder()
                .url(resource.fileUrl)
                .build();
        
        try {
            Response response = httpClient.newCall(request).execute();
            if (!response.isSuccessful()) {
                callback.onError("HTTP " + response.code());
                return;
            }
            
            InputStream inputStream = response.body().byteStream();
            FileOutputStream outputStream = new FileOutputStream(localFile);
            
            long totalBytes = response.body().contentLength();
            long downloadedBytes = 0;
            byte[] buffer = new byte[8192];
            int bytesRead;
            
            while ((bytesRead = inputStream.read(buffer)) != -1) {
                outputStream.write(buffer, 0, bytesRead);
                downloadedBytes += bytesRead;
                
                if (totalBytes > 0) {
                    int percentage = (int) ((downloadedBytes * 100) / totalBytes);
                    callback.onProgress(downloadedBytes, totalBytes, percentage);
                }
            }
            
            outputStream.close();
            inputStream.close();
            
            // Verify checksum
            if (verifyChecksum(localFile, resource.checksum)) {
                callback.onCompleted(localFile.getAbsolutePath());
            } else {
                localFile.delete();
                callback.onError("Checksum verification failed");
            }
            
        } catch (Exception e) {
            callback.onError("Download failed: " + e.getMessage());
        }
    }
    
    // ==================== File Management ====================
    
    private File createTextbookDirectory(TextbookVersion textbook) {
        File baseDir = new File(context.getExternalFilesDir(null), "LearnResources");
        File subjectDir = new File(baseDir, sanitizeFileName(textbook.textbookSubjectLabel));
        File textbookDir = new File(subjectDir, sanitizeFileName(
                textbook.textbookName + "_" + textbook.textbookGradeLabel + "_" + textbook.textbookSemesterLabel
        ));
        textbookDir.mkdirs();
        return textbookDir;
    }
    
    private String sanitizeFileName(String fileName) {
        return fileName.replaceAll("[^a-zA-Z0-9\u4e00-\u9fa5._-]", "_");
    }
    
    private void saveResourceIndex(File textbookDir, ResourceIndex index) {
        try {
            File indexFile = new File(textbookDir, "resource_index.json");
            String json = gson.toJson(index);
            FileOutputStream fos = new FileOutputStream(indexFile);
            fos.write(json.getBytes("UTF-8"));
            fos.close();
        } catch (Exception e) {
            Log.e(TAG, "Error saving resource index", e);
        }
    }
    
    public ResourceIndex loadResourceIndex(File textbookDir) {
        try {
            File indexFile = new File(textbookDir, "resource_index.json");
            if (!indexFile.exists()) return null;
            
            byte[] bytes = new byte[(int) indexFile.length()];
            java.io.FileInputStream fis = new java.io.FileInputStream(indexFile);
            fis.read(bytes);
            fis.close();
            
            String json = new String(bytes, "UTF-8");
            return gson.fromJson(json, ResourceIndex.class);
        } catch (Exception e) {
            Log.e(TAG, "Error loading resource index", e);
            return null;
        }
    }
    
    private boolean verifyChecksum(File file, String expectedChecksum) {
        try {
            MessageDigest md = MessageDigest.getInstance("MD5");
            java.io.FileInputStream fis = new java.io.FileInputStream(file);
            byte[] buffer = new byte[8192];
            int bytesRead;
            
            while ((bytesRead = fis.read(buffer)) != -1) {
                md.update(buffer, 0, bytesRead);
            }
            fis.close();
            
            byte[] digest = md.digest();
            StringBuilder sb = new StringBuilder();
            for (byte b : digest) {
                sb.append(String.format("%02x", b));
            }
            
            return sb.toString().equals(expectedChecksum);
        } catch (Exception e) {
            Log.e(TAG, "Error verifying checksum", e);
            return false;
        }
    }
    
    private String getLastUpdateTime(String textbookId) {
        return preferences.getString("update_time_" + textbookId, null);
    }
    
    private void saveLastUpdateTime(String textbookId, String updateTime) {
        preferences.edit().putString("update_time_" + textbookId, updateTime).apply();
    }
    
    // ==================== Utility Methods ====================
    
    private String md5(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("MD5");
            byte[] digest = md.digest(input.getBytes());
            StringBuilder sb = new StringBuilder();
            for (byte b : digest) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (Exception e) {
            throw new RuntimeException("MD5 hash failed", e);
        }
    }
    
    public void cleanup() {
        if (executorService != null && !executorService.isShutdown()) {
            executorService.shutdown();
        }
    }
}
