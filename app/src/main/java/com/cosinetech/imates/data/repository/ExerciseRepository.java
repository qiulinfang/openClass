package com.cosinetech.imates.data.repository;

import android.util.Log;

import androidx.lifecycle.LiveData;
import androidx.lifecycle.MutableLiveData;

import com.airbnb.lottie.L;
import com.cosinetech.imates.coreapiservice.ApiGateWayService;
import com.cosinetech.imates.coreapiservice.ApiUrl;
import com.cosinetech.imates.coreapiservice.Question;
import com.cosinetech.imates.data.models.AddQuestionRequest;
import com.cosinetech.imates.data.models.FindSimilarQuestionRequest;
import com.cosinetech.imates.data.models.Subject;

import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * 题目数据仓库
 * 负责封装所有与题目相关的API调用
 */
public class ExerciseRepository {
    private static ExerciseRepository instance;
    private final ExecutorService executor = Executors.newCachedThreadPool();
    
    private ExerciseRepository() {}
    
    public static synchronized ExerciseRepository getInstance() {
        if (instance == null) {
            instance = new ExerciseRepository();
        }
        return instance;
    }

    /**
     * 获取题目列表 - 通过Subject枚举
     */
    public LiveData<ApiResult<List<Question>>> getExerciseList(Subject subject, String token) {
        MutableLiveData<ApiResult<List<Question>>> result = new MutableLiveData<>();
        
        String url = getExerciseListUrl(subject);
        if (url == null) {
            result.setValue(ApiResult.error("不支持的科目"));
            return result;
        }
        
        result.setValue(ApiResult.loading());
        
        ApiGateWayService.queryExerciseList(url, token, new ApiGateWayService.QueryExerciseListCallback() {
            @Override
            public void onSuccess(List<Question> questions, long totalCount, long pageSize, long currentPageNo) {
                result.postValue(ApiResult.success(questions));
            }

            @Override
            public void onFailure(String msg, int code) {
                result.postValue(ApiResult.error(msg, code));
            }
        });
        
        return result;
    }

    /**
     * 获取题目列表 - 通过字符串科目名（新增重载方法）
     */
    public LiveData<ApiResult<List<Question>>> getExerciseListBySubject(String subjectName, String token) {
        MutableLiveData<ApiResult<List<Question>>> result = new MutableLiveData<>();
        
        // 参数验证
        if (subjectName == null || subjectName.trim().isEmpty()) {
            result.setValue(ApiResult.error("科目名称不能为空"));
            return result;
        }
        
        if (token == null || token.trim().isEmpty()) {
            result.setValue(ApiResult.error("用户token不能为空"));
            return result;
        }
        
        result.setValue(ApiResult.loading());
        
        // 直接使用新的语义化API
        ApiGateWayService.queryExerciseListBySubject(subjectName, token, new ApiGateWayService.QueryExerciseListCallback() {
            @Override
            public void onSuccess(List<Question> questions, long totalCount, long pageSize, long currentPageNo) {
                result.postValue(ApiResult.success(questions));
            }

            @Override
            public void onFailure(String msg, int code) {
                result.postValue(ApiResult.error(msg, code));
            }
        });
        
        return result;
    }

    /**
     * 获取题目列表 - 统一入口方法
     */
    public LiveData<ApiResult<List<Question>>> getExerciseList(String subjectName, String token) {
        // 统一使用字符串参数的方法
        return getExerciseListBySubject(subjectName, token);
    }

    /**
     * 删除题目
     */
    public LiveData<ApiResult<Boolean>> deleteExercise(String exerciseId, Subject subject, String token) {
        MutableLiveData<ApiResult<Boolean>> result = new MutableLiveData<>();
        
        String url = getDeleteExerciseUrl(exerciseId, subject);
        if (url == null) {
            result.setValue(ApiResult.error("不支持的科目"));
            return result;
        }
        
        result.setValue(ApiResult.loading());
        
        ApiGateWayService.deleteExercise(url, token, new ApiGateWayService.ExerciseDeleteLister() {
            @Override
            public void onDeleteSuccess() {
                result.postValue(ApiResult.success(true));
            }

            @Override
            public void onDeleteFailed(String msg) {
                result.postValue(ApiResult.error(msg));
            }
        });
        
        return result;
    }

    /**
     * 查找相似题目
     */
    public LiveData<ApiResult<List<Question>>> findSimilarQuestions(Question question, String existingIds, Subject subject, String token) {
        MutableLiveData<ApiResult<List<Question>>> result = new MutableLiveData<>();
        
        String subjectType = getSubjectType(subject);
        if (subjectType == null) {
            result.setValue(ApiResult.error("不支持的科目"));
            return result;
        }
        
        result.setValue(ApiResult.loading());
        
        FindSimilarQuestionRequest request = FindSimilarQuestionRequest.fromQuestion(question, existingIds, subjectType);
        
        ApiGateWayService.querySimilarExerciseList(request, ApiUrl.URL_QUERY_SIMILAR_EXERCISE, token, 
            new ApiGateWayService.QueryExerciseListCallback() {
                @Override
                public void onSuccess(List<Question> questions, long totalCount, long pageSize, long currentPageNo) {
                    result.postValue(ApiResult.success(questions));
                }

                @Override
                public void onFailure(String msg, int code) {
                    result.postValue(ApiResult.error(msg, code));
                }
            });
        
        return result;
    }

    /**
     * 添加题目到列表
     */
    public LiveData<ApiResult<Boolean>> addQuestionToList(Question question, String existingIds, Subject subject, String token) {
        MutableLiveData<ApiResult<Boolean>> result = new MutableLiveData<>();
        
        String subjectType = getSubjectType(subject);
        if (subjectType == null) {
            result.setValue(ApiResult.error("不支持的科目"));
            return result;
        }
        
        result.setValue(ApiResult.loading());
        
        AddQuestionRequest request = new AddQuestionRequest();
        request.setExercisesId(existingIds);
        request.setBmNo(question.bmNo);
        request.setType(subjectType);
        
        ApiGateWayService.addExerciseToList(request, ApiUrl.URL_ADD_EXERCISE_TO_LIST, token, 
            new ApiGateWayService.AddExerciseCallback() {
                @Override
                public void onSuccess() {
                    result.postValue(ApiResult.success(true));
                }

                @Override
                public void onFailure(String msg, int code) {
                    result.postValue(ApiResult.error(msg, code));
                }
            });
        
        return result;
    }

    // 辅助方法
    private String getExerciseListUrl(Subject subject) {
        switch (subject) {
            case SUBJECT_BIOLOGY:
                return ApiUrl.URL_GET_EXERCISE_BIOLOGY;
            case SUBJECT_MATH:
                return ApiUrl.URL_GET_EXERCISE_MATH;
            default:
                return null;
        }
    }
    
    private String getDeleteExerciseUrl(String exerciseId, Subject subject) {
        switch (subject) {
            case SUBJECT_BIOLOGY:
                return ApiUrl.URL_DELETE_EXERCISE_BASE + "/" + exerciseId + "/biology";
            case SUBJECT_MATH:
                return ApiUrl.URL_DELETE_EXERCISE_BASE + "/" + exerciseId + "/math";
            default:
                return null;
        }
    }
    
    private String getSubjectType(Subject subject) {
        switch (subject) {
            case SUBJECT_BIOLOGY:
                return "biology";
            case SUBJECT_MATH:
                return "math";
            default:
                return null;
        }
    }

    /**
     * API结果包装类
     */
    public static class ApiResult<T> {
        public enum Status {
            SUCCESS, ERROR, LOADING
        }
        
        private final Status status;
        private final T data;
        private final String message;
        private final int code;
        
        private ApiResult(Status status, T data, String message, int code) {
            this.status = status;
            this.data = data;
            this.message = message;
            this.code = code;
        }
        
        public static <T> ApiResult<T> success(T data) {
            return new ApiResult<>(Status.SUCCESS, data, null, 0);
        }
        
        public static <T> ApiResult<T> error(String message) {
            return new ApiResult<>(Status.ERROR, null, message, 0);
        }
        
        public static <T> ApiResult<T> error(String message, int code) {
            return new ApiResult<>(Status.ERROR, null, message, code);
        }
        
        public static <T> ApiResult<T> loading() {
            return new ApiResult<>(Status.LOADING, null, null, 0);
        }
        
        public Status getStatus() { return status; }
        public T getData() { return data; }
        public String getMessage() { return message; }
        public int getCode() { return code; }
        
        public boolean isSuccess() { return status == Status.SUCCESS; }
        public boolean isError() { return status == Status.ERROR; }
        public boolean isLoading() { return status == Status.LOADING; }
    }
}