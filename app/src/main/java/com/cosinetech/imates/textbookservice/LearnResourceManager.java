package com.cosinetech.imates.textbookservice;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import androidx.annotation.NonNull;

import com.cosinetech.imates.ApplicationModelShared;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.security.MessageDigest;
import java.security.cert.X509Certificate;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import javax.net.ssl.HostnameVerifier;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLSession;
import javax.net.ssl.SSLSocketFactory;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;

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
    
    private final Context context;
    private final Gson gson;
    private final Handler mainHandler;
    private final ExecutorService executorService;
    private final SimpleDateFormat dateFormat;
    
    private String currentToken;
    private String currentUsername;

    private static LearnResourceManager instance;

    synchronized  public static LearnResourceManager getInstance() {
        if (instance == null) {
            instance = new LearnResourceManager();
        }
        return instance;
    }

    private LearnResourceManager() {
        this.context = ApplicationModelShared.getInstance();
//        this.httpClient = new OkHttpClient.Builder()
//                .connectTimeout(30, TimeUnit.SECONDS)
//                .readTimeout(60, TimeUnit.SECONDS)
//                .writeTimeout(60, TimeUnit.SECONDS)
//                .build();
        this.gson = new GsonBuilder()
                .setDateFormat("yyyy-MM-dd HH:mm:ss")
                .create();
        this.mainHandler = new Handler(Looper.getMainLooper());
        this.executorService = Executors.newFixedThreadPool(4);
        this.dateFormat = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault());
    }

    public static OkHttpClient getUnsafeOkHttpClient() {
        try {
            // 创建一个不验证证书链的信任管理器
            final TrustManager[] trustAllCerts = new TrustManager[]{
                    new X509TrustManager() {
                        @Override
                        public void checkClientTrusted(X509Certificate[] chain, String authType) {
                        }

                        @Override
                        public void checkServerTrusted(X509Certificate[] chain, String authType) {
                        }

                        @Override
                        public X509Certificate[] getAcceptedIssuers() {
                            return new X509Certificate[]{};
                        }
                    }
            };

            // 安装全信任的信任管理器
            final SSLContext sslContext = SSLContext.getInstance("SSL");
            sslContext.init(null, trustAllCerts, new java.security.SecureRandom());

            // 创建不验证主机名的SSLSocketFactory
            final SSLSocketFactory sslSocketFactory = sslContext.getSocketFactory();

            OkHttpClient.Builder builder = new OkHttpClient.Builder();
            builder.sslSocketFactory(sslSocketFactory, (X509TrustManager)trustAllCerts[0]);
            builder.hostnameVerifier(new HostnameVerifier() {
                @Override
                public boolean verify(String hostname, SSLSession session) {
                    return true; // 验证所有主机名
                }
            });

            return builder
                    .connectTimeout(30, TimeUnit.SECONDS)
                    .readTimeout(30, TimeUnit.SECONDS)
                    .writeTimeout(30, TimeUnit.SECONDS)
                    .build();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
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
            
            getUnsafeOkHttpClient().newCall(httpRequest).enqueue(new Callback() {
                @Override
                public void onFailure(@NonNull Call call, @NonNull IOException e) {
                    mainHandler.post(() -> callback.onError("Network error: " + e.getMessage()));
                }
                
                @Override
                public void onResponse(@NonNull Call call, @NonNull Response response) {
                    try {
                        String responseBody = response.body().string();
                        ApiResponse<LoginData> apiResponse = gson.fromJson(responseBody, 
                                new TypeToken<ApiResponse<LoginData>>(){}.getType());
                        
                        if (apiResponse.success && apiResponse.data != null) {
                            boolean userChanged = currentUsername != null && !currentUsername.equals(account);
                            
                            currentToken = apiResponse.data.token;
                            currentUsername = account;
                            
                            if (userChanged || loadUserLearnData() == null) {
                                initializeUserLearnData();
                            }
                            
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
    
    public boolean isLoggedIn() {
        return currentToken != null && !currentToken.isEmpty() && currentUsername != null;
    }
    
    public void logout() {
        currentToken = null;
        currentUsername = null;
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
        
        getUnsafeOkHttpClient().newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                mainHandler.post(() -> callback.onError("Network error: " + e.getMessage()));
            }
            
            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) {
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
        
        getUnsafeOkHttpClient().newCall(httpRequest).enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                mainHandler.post(() -> callback.onError("Network error: " + e.getMessage()));
            }
            
            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) {
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
    
    public interface LearningResourcesCallback {
        void onSuccess(List<LearningPackage> resources);
        void onError(String error);
        void onUnauthorized();
    }
    
    public void getLearningResources(String textbookVersionId, LearningResourcesCallback callback) {
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
        
        getUnsafeOkHttpClient().newCall(httpRequest).enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                mainHandler.post(() -> callback.onError("Network error: " + e.getMessage()));
            }
            
            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) {
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

    public interface AllTextbooksCallback {
        void onSuccess(List<UserTextbookInfo> textbooks);
        void onError(String error);
    }

    public void loadAllUserTextbooks(AllTextbooksCallback callback) {
        executorService.execute(() -> {
            try {
                UserLearnData data = loadUserLearnData();
                if (data == null) {
                    mainHandler.post(() -> callback.onSuccess(new ArrayList<>()));
                    return;
                }

                getTextbookVersions(new TextbookVersionsCallback() {
                    @Override
                    public void onSuccess(List<TextbookVersion> serverTextbooks) {
                        executorService.execute(() -> {
                            try {
                                for (TextbookVersion serverTextbook : serverTextbooks) {
                                    UserTextbookInfo localInfo = data.findTextbook(serverTextbook.textbookId);
                                    if (localInfo == null) {
                                        localInfo = new UserTextbookInfo(serverTextbook);
                                        data.updateOrAddTextbook(localInfo);
                                    } else {
                                        localInfo.textbookIsbn = serverTextbook.textbookIsbn;
                                        localInfo.textbookEditionYear = serverTextbook.textbookEditionYear;
                                        localInfo.textbookPublisher = serverTextbook.textbookPublisher;
                                        localInfo.textbookCover = BASE_URL + serverTextbook.textbookCover;
                                        localInfo.textbookUpdateTime = serverTextbook.textbookUpdateTime;
                                        localInfo.textbookName = serverTextbook.textbookName;
                                        localInfo.textbookSubjectLabel = serverTextbook.textbookSubjectLabel;
                                        localInfo.textbookGradeLabel = serverTextbook.textbookGradeLabel;
                                        localInfo.textbookSemesterLabel = serverTextbook.textbookSemesterLabel;
                                    }
                                }

                                saveUserLearnData(data);
                                mainHandler.post(() -> callback.onSuccess(data.textbooks));
                            } catch (Exception e) {
                                mainHandler.post(() -> callback.onError("Error processing textbooks: " + e.getMessage()));
                            }
                        });
                    }

                    @Override
                    public void onError(String error) {
                        mainHandler.post(() -> callback.onSuccess(data.textbooks));
                    }

                    @Override
                    public void onUnauthorized() {
                        mainHandler.post(() -> callback.onError("Authentication required"));
                    }
                });

            } catch (Exception e) {
                mainHandler.post(() -> callback.onError("Error loading textbooks: " + e.getMessage()));
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
                        UserLearnData userLearnData = loadUserLearnData();
                        
                        for (TextbookVersion version : versions) {
                            UserTextbookInfo localInfo = userLearnData != null ? 
                                    userLearnData.findTextbook(version.textbookId) : null;
                            
                            if (localInfo == null || isNewer(version.textbookUpdateTime, localInfo.textbookUpdateTime)) {
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
        getLearningResources(textbook.id, new LearningResourcesCallback() {
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
            File textbookDir = createUserTextbookDirectory(textbook);
            
            getTextbookStructure(textbook.textbookId, new TextbookStructureCallback() {
                @Override
                public void onSuccess(List<ChapterNode> structure) {
                    // Continue with download and save structure
                    continueDownloadWithStructure(textbook, packages, structure, textbookDir, callback);
                }
                
                @Override
                public void onError(String error) {
                    Log.w(TAG, "Failed to get structure, continuing without it: " + error);
                    continueDownloadWithStructure(textbook, packages, new ArrayList<>(), textbookDir, callback);
                }
                
                @Override
                public void onUnauthorized() {
                    callback.onError("", "Authentication required");
                }
            });
            
        } catch (Exception e) {
            Log.e(TAG, "Error in downloadResourcesInBackground", e);
            mainHandler.post(() -> callback.onError("", "Download error: " + e.getMessage()));
        }
    }
    
    private void continueDownloadWithStructure(TextbookVersion textbook, List<LearningPackage> packages, 
                                             List<ChapterNode> structure, File textbookDir, DownloadProgressCallback callback) {
        try {
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
                        
                        if (localFile.exists() && verifyChecksum(localFile, resource.checksum)) {
                            completedFiles++;
                            mainHandler.post(() -> callback.onFileCompleted(resource.fileName, localFile.getAbsolutePath()));
                            continue;
                        }
                        
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
            
            saveResourceIndex(textbookDir, index);
            
            updateUserTextbookInfoWithStructureAndPackages(textbook, structure, packages, totalFiles, completedFiles, true);
            
            mainHandler.post(callback::onAllCompleted);
            
        } catch (Exception e) {
            Log.e(TAG, "Error in continueDownloadWithStructure", e);
            mainHandler.post(() -> callback.onError("", "Download error: " + e.getMessage()));
        }
    }
    
    // ==================== File Management ====================
    
    private File createUserTextbookDirectory(TextbookVersion textbook) {
        File baseDir = new File(context.getExternalFilesDir(null), "LearnResources");
        File userDir = new File(baseDir, sanitizeFileName(currentUsername));
        File subjectDir = new File(userDir, sanitizeFileName(textbook.textbookSubjectLabel));
        File textbookDir = new File(subjectDir, sanitizeFileName(textbook.textbookId + "_" +
                textbook.textbookName + "_" + textbook.textbookGradeLabel + "_" + textbook.textbookSemesterLabel
        ));
        textbookDir.mkdirs();
        return textbookDir;
    }
    
    private File getUserLearnDirectory() {
        if (currentUsername == null) return null;
        File baseDir = new File(context.getExternalFilesDir(null), "LearnResources");
        File userDir = new File(baseDir, sanitizeFileName(currentUsername));
        userDir.mkdirs();
        return userDir;
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
    
    private ResourceIndex loadResourceIndex(File textbookDir) {
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
    
    private UserLearnData loadUserLearnData() {
        try {
            File learnDir = getUserLearnDirectory();
            if (learnDir == null) return null;
            
            File dataFile = new File(learnDir, "user_learn_data.json");
            if (!dataFile.exists()) return null;
            
            byte[] bytes = new byte[(int) dataFile.length()];
            java.io.FileInputStream fis = new java.io.FileInputStream(dataFile);
            fis.read(bytes);
            fis.close();
            
            String json = new String(bytes, "UTF-8");
            return gson.fromJson(json, UserLearnData.class);
        } catch (Exception e) {
            Log.e(TAG, "Error loading user learn data", e);
            return null;
        }
    }
    
    private void saveUserLearnData(UserLearnData data) {
        try {
            File learnDir = getUserLearnDirectory();
            if (learnDir == null) return;
            
            File dataFile = new File(learnDir, "user_learn_data.json");
            String json = gson.toJson(data);
            FileOutputStream fos = new FileOutputStream(dataFile);
            fos.write(json.getBytes("UTF-8"));
            fos.close();
        } catch (Exception e) {
            Log.e(TAG, "Error saving user learn data", e);
        }
    }
    
    private void initializeUserLearnData() {
        UserLearnData data = new UserLearnData(currentUsername);
        data.lastSyncTime = dateFormat.format(new Date());
        saveUserLearnData(data);
    }
    
    private void updateUserTextbookInfoWithStructureAndPackages(TextbookVersion textbook, List<ChapterNode> structure, 
                                                               List<LearningPackage> packages, int totalFiles, int downloadedFiles, boolean isDownloaded) {
        UserLearnData data = loadUserLearnData();
        if (data == null) {
            data = new UserLearnData(currentUsername);
        }
        
        UserTextbookInfo info = data.findTextbook(textbook.textbookId);
        if (info == null) {
            info = new UserTextbookInfo(textbook);
            data.updateOrAddTextbook(info);
        }
        
        // Update basic info
        info.totalFiles = totalFiles;
        info.downloadedFiles = downloadedFiles;
        info.isDownloaded = isDownloaded;
        info.lastDownloadTime = dateFormat.format(new Date());
        
        info.updateStructure(structure);
        info.updatePackages(packages);
        
        // Update local file status
        updateLocalFileStatus(info);
        
        data.lastSyncTime = dateFormat.format(new Date());
        saveUserLearnData(data);
    }
    
    // ==================== Local Access ====================
    
    /**
     * Interface to get textbook structure from local metadata
     */
    public interface TextbookStructureLocalCallback {
        void onSuccess(List<ChapterNode> structure);
        void onNotFound(); // Structure not cached locally
        void onError(String error);
    }
    
    /**
     * Get textbook structure from local cache first, fallback to server if needed
     */
    public void getTextbookStructureLocal(String textbookId, boolean allowServerFallback, TextbookStructureLocalCallback callback) {
        executorService.execute(() -> {
            try {
                UserLearnData data = loadUserLearnData();
                if (data != null) {
                    UserTextbookInfo textbook = data.findTextbook(textbookId);
                    if (textbook != null && textbook.structure != null && !textbook.structure.isEmpty()) {
                        mainHandler.post(() -> callback.onSuccess(textbook.structure));
                        return;
                    }
                }
                
                if (allowServerFallback) {
                    // Fallback to server
                    getTextbookStructure(textbookId, new TextbookStructureCallback() {
                        @Override
                        public void onSuccess(List<ChapterNode> structure) {
                            // Save structure to local metadata
                            saveTextbookStructure(textbookId, structure);
                            callback.onSuccess(structure);
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
                } else {
                    mainHandler.post(callback::onNotFound);
                }
            } catch (Exception e) {
                mainHandler.post(() -> callback.onError("Error loading structure: " + e.getMessage()));
            }
        });
    }
    
    public interface TextbookPackagesCallback {
        void onSuccess(List<LocalPackageInfo> packages);
        void onError(String error);
    }
    
    public void getTextbookPackagesWithLocalFiles(String textbookId, TextbookPackagesCallback callback) {
        executorService.execute(() -> {
            try {
                UserLearnData data = loadUserLearnData();
                if (data == null) {
                    mainHandler.post(() -> callback.onSuccess(new ArrayList<>()));
                    return;
                }
                
                UserTextbookInfo textbook = data.findTextbook(textbookId);
                if (textbook == null) {
                    mainHandler.post(() -> callback.onSuccess(new ArrayList<>()));
                    return;
                }
                
                // Update local file status by checking actual files
                updateLocalFileStatus(textbook);
                
                mainHandler.post(() -> callback.onSuccess(textbook.localPackages));
            } catch (Exception e) {
                mainHandler.post(() -> callback.onError("Error loading packages: " + e.getMessage()));
            }
        });
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
    
    private void saveTextbookStructure(String textbookId, List<ChapterNode> structure) {
        executorService.execute(() -> {
            try {
                UserLearnData data = loadUserLearnData();
                if (data == null) return;
                
                UserTextbookInfo textbook = data.findTextbook(textbookId);
                if (textbook != null) {
                    textbook.updateStructure(structure);
                    saveUserLearnData(data);
                }
            } catch (Exception e) {
                Log.e(TAG, "Error saving textbook structure", e);
            }
        });
    }
    
    private void updateLocalFileStatus(UserTextbookInfo textbook) {
        File textbookDir = getTextbookDirectoryById(textbook.textbookId);
        if (textbookDir == null || !textbookDir.exists()) {
            // Mark all files as not downloaded
            for (LocalPackageInfo pkg : textbook.localPackages) {
                for (LocalFileInfo file : pkg.localFiles) {
                    file.isDownloaded = false;
                    file.localPath = null;
                }
                pkg.updateDownloadStatus();
            }
            return;
        }
        
        for (LocalPackageInfo pkg : textbook.localPackages) {
            File packageDir = new File(textbookDir, sanitizeFileName(pkg.packageName));
            
            for (LocalFileInfo file : pkg.localFiles) {
                File localFile = new File(packageDir, file.fileName);
                if (localFile.exists() && verifyChecksum(localFile, file.checksum)) {
                    file.isDownloaded = true;
                    file.localPath = localFile.getAbsolutePath();
                    file.fileSize = localFile.length();
                } else {
                    file.isDownloaded = false;
                    file.localPath = null;
                    file.fileSize = 0;
                }
            }
            pkg.updateDownloadStatus();
        }
        
        // Update overall textbook download status
        int totalFiles = 0;
        int downloadedFiles = 0;
        for (LocalPackageInfo pkg : textbook.localPackages) {
            totalFiles += pkg.totalFiles;
            downloadedFiles += pkg.downloadedFiles;
        }
        
        textbook.totalFiles = totalFiles;
        textbook.downloadedFiles = downloadedFiles;
        textbook.isDownloaded = (downloadedFiles == totalFiles && totalFiles > 0);
        textbook.downloadStatus = calculateDownloadStatus(downloadedFiles, totalFiles);
    }
    
    private File getTextbookDirectoryById(String textbookId) {
        UserLearnData data = loadUserLearnData();
        if (data == null) return null;
        
        UserTextbookInfo textbook = data.findTextbook(textbookId);
        if (textbook == null) return null;
        
        File learnDir = getUserLearnDirectory();
        File subjectDir = new File(learnDir, sanitizeFileName(textbook.textbookSubjectLabel));
        File textbookDir = new File(subjectDir, sanitizeFileName(textbook.textbookId + "_" +
                textbook.textbookName + "_" + textbook.textbookGradeLabel + "_" + textbook.textbookSemesterLabel
        ));
        
        return textbookDir;
    }
    
    private void addReferencedFiles(File dir, Set<String> referencedFiles) {
        File learnDir = getUserLearnDirectory();
        if (learnDir == null) return;
        
        File[] files = dir.listFiles();
        if (files != null) {
            for (File file : files) {
                if (file.isFile()) {
                    String relativePath = getRelativePath(learnDir, file);
                    referencedFiles.add(relativePath);
                } else if (file.isDirectory()) {
                    addReferencedFiles(file, referencedFiles);
                }
            }
        }
    }
    
    private List<File> getAllFiles(File dir) {
        List<File> files = new ArrayList<>();
        File[] dirFiles = dir.listFiles();
        if (dirFiles != null) {
            for (File file : dirFiles) {
                if (file.isFile()) {
                    files.add(file);
                } else if (file.isDirectory()) {
                    files.addAll(getAllFiles(file));
                }
            }
        }
        return files;
    }
    
    private String getRelativePath(File baseDir, File file) {
        return baseDir.toURI().relativize(file.toURI()).getPath();
    }
    
    private void cleanupEmptyDirectories(File dir) {
        File[] files = dir.listFiles();
        if (files != null) {
            for (File file : files) {
                if (file.isDirectory()) {
                    cleanupEmptyDirectories(file);
                    File[] remainingFiles = file.listFiles();
                    if (remainingFiles != null && remainingFiles.length == 0) {
                        file.delete();
                    }
                }
            }
        }
    }

    private String sanitizeFileName(String fileName) {
        return fileName.replaceAll("[^a-zA-Z0-9\u4e00-\u9fa5._-]", "_");
    }
    
    private int calculateDownloadStatus(int downloadedFiles, int totalFiles) {
        if (totalFiles == 0) return 100; // No files to download
        return (int) ((downloadedFiles * 100) / totalFiles);
    }
    
    private interface SingleFileDownloadCallback {
        void onProgress(long downloadedBytes, long totalBytes, int percentage);
        void onCompleted(String localPath);
        void onError(String error);
    }
    
    private void downloadFile(ResourceFile resource, File localFile, SingleFileDownloadCallback callback) {
        Request request = new Request.Builder()
                .url(BASE_URL + resource.fileUrl)
                .build();
        
        try {
            Response response = getUnsafeOkHttpClient().newCall(request).execute();
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
}
