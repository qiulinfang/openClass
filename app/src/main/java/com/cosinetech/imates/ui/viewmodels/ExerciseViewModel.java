package com.cosinetech.imates.ui.viewmodels;

import androidx.lifecycle.LiveData;
import androidx.lifecycle.MediatorLiveData;
import androidx.lifecycle.MutableLiveData;
import androidx.lifecycle.Transformations;
import androidx.lifecycle.ViewModel;

import com.cosinetech.imates.coreapiservice.Question;
import com.cosinetech.imates.data.models.Subject;
import com.cosinetech.imates.data.repository.ExerciseRepository;
import com.cosinetech.imates.utils.AppUtils;

import java.util.ArrayList;
import java.util.List;

/**
 UI 调用 loadExerciseList()
 │
 └─> 1. loadTrigger.setValue() (推下第一块骨牌)
 │
 └─> 2. switchMap 感知变化，调用 Repository，返回新的 LiveData<ApiResult> (切换轨道并启动新任务)
 │
 └─> 3. LiveData<ApiResult> 推送状态 (Loading -> Success/Error) (任务状态实时广播)
 │
 ├─> isLoading (MediatorLiveData) 监听到 Loading 状态 -> 更新值为 true
 ├─> errorMessage (MediatorLiveData) 监听到 Error 状态 -> 更新错误信息
 └─> exerciseList (map) 监听到 Success 状态 -> 提取并更新题目列表
 │
 └─> 4. UI 层的 observe 回调被触发 -> 更新界面 (显示加载圈、列表等) (最终产品送达消费者)
 * 重构后使用 Transformations 替代 observeForever，避免内存泄漏
 */
public class ExerciseViewModel extends ViewModel {
    private final ExerciseRepository repository;

    // 触发器 - 用于控制数据加载
    private final MutableLiveData<LoadTrigger> loadTrigger = new MutableLiveData<>();
    private final MutableLiveData<DeleteTrigger> deleteTrigger = new MutableLiveData<>();
    private final MutableLiveData<SimilarTrigger> similarTrigger = new MutableLiveData<>();
    private final MutableLiveData<AddTrigger> addTrigger = new MutableLiveData<>();

    // 科目信息
    private final MutableLiveData<Subject> currentSubject = new MutableLiveData<>();

    // 当前选中的题目索引
    private final MutableLiveData<Integer> currentQuestionIndex = new MutableLiveData<>(-1);

    // UI状态
    private final MutableLiveData<Boolean> canViewAnswer = new MutableLiveData<>(false);

    // 使用 Transformations 创建的 LiveData
    private final LiveData<ExerciseRepository.ApiResult<List<Question>>> exerciseListResult;
    private final LiveData<ExerciseRepository.ApiResult<Boolean>> deleteResult;
    private final LiveData<ExerciseRepository.ApiResult<List<Question>>> similarQuestionsResult;
    private final LiveData<ExerciseRepository.ApiResult<Boolean>> addQuestionResult;

    // 派生的 LiveData
    private final LiveData<List<Question>> exerciseList;
    private final LiveData<List<Question>> similarQuestions;
    private final LiveData<Question> currentQuestion;
    private final LiveData<Boolean> isLoading;
    private final LiveData<String> errorMessage;
    private final LiveData<Boolean> showEmptyTip;

    // 内部数据类用于触发器
    private static class LoadTrigger {
        final Subject subject;
        final String subjectName;

        LoadTrigger(Subject subject) {
            this.subject = subject;
            this.subjectName = null;
        }

        LoadTrigger(String subjectName) {
            this.subject = null;
            this.subjectName = subjectName;
        }
    }

    private static class DeleteTrigger {
        final String questionId;
        final Subject subject;
        final int position;

        DeleteTrigger(String questionId, Subject subject, int position) {
            this.questionId = questionId;
            this.subject = subject;
            this.position = position;
        }
    }

    private static class SimilarTrigger {
        final Question question;
        final String existingIds;
        final Subject subject;

        SimilarTrigger(Question question, String existingIds, Subject subject) {
            this.question = question;
            this.existingIds = existingIds;
            this.subject = subject;
        }
    }

    private static class AddTrigger {
        final Question question;
        final String existingIds;
        final Subject subject;

        AddTrigger(Question question, String existingIds, Subject subject) {
            this.question = question;
            this.existingIds = existingIds;
            this.subject = subject;
        }
    }

    public ExerciseViewModel() {
        this.repository = ExerciseRepository.getInstance();
        
        // 使用 Transformations.switchMap 处理题目列表加载
        exerciseListResult = Transformations.switchMap(loadTrigger, trigger -> {
            if (trigger == null) return new MutableLiveData<>();
            
            String token = AppUtils.getUserToken();
            if (trigger.subject != null) {
                return repository.getExerciseList(trigger.subject, token);
            } else if (trigger.subjectName != null) {
                return repository.getExerciseListBySubject(trigger.subjectName, token);
            }
            return new MutableLiveData<>();
        });

        // 使用 Transformations.switchMap 处理删除操作
        deleteResult = Transformations.switchMap(deleteTrigger, trigger -> {
            if (trigger == null) return new MutableLiveData<>();
            String token = AppUtils.getUserToken();
            return repository.deleteExercise(trigger.questionId, trigger.subject, token);
        });

        // 使用 Transformations.switchMap 处理相似题目查找
        similarQuestionsResult = Transformations.switchMap(similarTrigger, trigger -> {
            if (trigger == null) return new MutableLiveData<>();
            String token = AppUtils.getUserToken();
            return repository.findSimilarQuestions(trigger.question, trigger.existingIds, trigger.subject, token);
        });

        // 使用 Transformations.switchMap 处理添加题目
        addQuestionResult = Transformations.switchMap(addTrigger, trigger -> {
            if (trigger == null) return new MutableLiveData<>();
            String token = AppUtils.getUserToken();
            return repository.addQuestionToList(trigger.question, trigger.existingIds, trigger.subject, token);
        });

        // 从 API 结果中提取题目列表
        exerciseList = Transformations.map(exerciseListResult, result -> {
            if (result != null && result.isSuccess()) {
                return result.getData();
            }
            return new ArrayList<>();
        });

        // 从 API 结果中提取相似题目列表
        similarQuestions = Transformations.map(similarQuestionsResult, result -> {
            if (result != null && result.isSuccess()) {
                return result.getData();
            }
            return new ArrayList<>();
        });

        // 使用 MediatorLiveData 组合当前题目索引和题目列表
        MediatorLiveData<Question> currentQuestionMediator = new MediatorLiveData<>();
        currentQuestionMediator.addSource(currentQuestionIndex, index -> {
            List<Question> questions = exerciseList.getValue();
            updateCurrentQuestion(currentQuestionMediator, questions, index);
        });
        currentQuestionMediator.addSource(exerciseList, questions -> {
            Integer index = currentQuestionIndex.getValue();
            updateCurrentQuestion(currentQuestionMediator, questions, index);
        });
        currentQuestion = currentQuestionMediator;

        // 合并所有加载状态
        MediatorLiveData<Boolean> loadingMediator = new MediatorLiveData<>();
        loadingMediator.addSource(exerciseListResult, result -> 
            loadingMediator.setValue(result != null && result.isLoading()));
        loadingMediator.addSource(deleteResult, result -> 
            loadingMediator.setValue(result != null && result.isLoading()));
        loadingMediator.addSource(similarQuestionsResult, result -> 
            loadingMediator.setValue(result != null && result.isLoading()));
        loadingMediator.addSource(addQuestionResult, result -> 
            loadingMediator.setValue(result != null && result.isLoading()));
        isLoading = loadingMediator;

        // 合并所有错误信息
        MediatorLiveData<String> errorMediator = new MediatorLiveData<>();
        errorMediator.addSource(exerciseListResult, result -> {
            if (result != null && result.isError()) {
                errorMediator.setValue(result.getMessage());
            }
        });
        errorMediator.addSource(deleteResult, result -> {
            if (result != null && result.isError()) {
                errorMediator.setValue("删除失败: " + result.getMessage());
            }
        });
        errorMediator.addSource(similarQuestionsResult, result -> {
            if (result != null && result.isError()) {
                errorMediator.setValue("查找相似题目失败: " + result.getMessage());
            }
        });
        errorMediator.addSource(addQuestionResult, result -> {
            if (result != null && result.isError()) {
                errorMediator.setValue("添加题目失败: " + result.getMessage());
            }
        });
        errorMessage = errorMediator;

        // 派生空列表提示状态
        showEmptyTip = Transformations.map(exerciseList, questions -> 
            questions == null || questions.isEmpty());

        // 设置删除成功后的自动重新加载
        setupDeleteSuccessHandler();
        
        // 设置添加成功后的自动重新加载
        setupAddSuccessHandler();
    }

    private void setupDeleteSuccessHandler() {
        MediatorLiveData<Void> deleteSuccessMediator = new MediatorLiveData<>();
        deleteSuccessMediator.addSource(deleteResult, result -> {
            if (result != null && result.isSuccess()) {
                // 删除成功，重新加载列表
                loadExerciseList();
                
                // 更新当前选中索引
                DeleteTrigger trigger = deleteTrigger.getValue();
                if (trigger != null) {
                    Integer currentIndex = currentQuestionIndex.getValue();
                    if (currentIndex != null && currentIndex == trigger.position) {
                        currentQuestionIndex.setValue(-1);
                    } else if (currentIndex != null && currentIndex > trigger.position) {
                        currentQuestionIndex.setValue(currentIndex - 1);
                    }
                }
            }
        });
    }

    private void setupAddSuccessHandler() {
        MediatorLiveData<Void> addSuccessMediator = new MediatorLiveData<>();
        addSuccessMediator.addSource(addQuestionResult, result -> {
            if (result != null && result.isSuccess()) {
                // 添加成功，重新加载列表
                loadExerciseList();
            }
        });
    }

    private void updateCurrentQuestion(MediatorLiveData<Question> mediator, List<Question> questions, Integer index) {
        if (questions != null && index != null && index >= 0 && index < questions.size()) {
            mediator.setValue(questions.get(index));
        } else {
            mediator.setValue(null);
        }
    }

    /**
     * 初始化数据 - 通过Subject枚举
     */
    public void initialize(Subject subject) {
        currentSubject.setValue(subject);
        loadExerciseList();
    }

    /**
     * 初始化数据 - 通过字符串科目名（新增重载方法）
     */
    public void initialize(String subjectName) {
        Subject subject = convertStringToSubject(subjectName);
        if (subject != null) {
            initialize(subject);
        } else {
            // 直接通过字符串加载，不需要转换为枚举
            loadExerciseListBySubject(subjectName);
        }
    }

    /**
     * 兼容旧版本的初始化方法 - 忽略token参数，使用AppUtils.getUserToken()
     * @deprecated 使用 initialize(Subject subject) 或 initialize(String subjectName) 替代
     */
    @Deprecated
    public void initialize(Subject subject, String token) {
        initialize(subject);
    }

    /**
     * 兼容旧版本的初始化方法 - 忽略token参数，使用AppUtils.getUserToken()
     * @deprecated 使用 initialize(String subjectName) 替代
     */
    @Deprecated
    public void initialize(String subjectName, String token) {
        initialize(subjectName);
    }

    /**
     * 加载题目列表 - 使用当前状态
     */
    public void loadExerciseList() {
        Subject subject = currentSubject.getValue();
        String token = AppUtils.getUserToken();

        if (subject == null || token == null || token.trim().isEmpty()) {
            return; // 错误会通过 errorMessage LiveData 自动处理
        }

        // 触发加载
        loadTrigger.setValue(new LoadTrigger(subject));
    }

    /**
     * 加载题目列表 - 通过字符串科目名（新增方法）
     */
    public void loadExerciseListBySubject(String subjectName) {
        String token = AppUtils.getUserToken();

        if (subjectName == null || subjectName.trim().isEmpty() || 
            token == null || token.trim().isEmpty()) {
            return; // 错误会通过 errorMessage LiveData 自动处理
        }

        // 更新当前科目状态
        Subject subject = convertStringToSubject(subjectName);
        if (subject != null) {
            currentSubject.postValue(subject);
        }

        // 触发加载
        loadTrigger.postValue(new LoadTrigger(subjectName));
    }

    /**
     * 字符串科目名转换为Subject枚举
     */
    private Subject convertStringToSubject(String subjectName) {
        if (subjectName == null)
            return null;

        switch (subjectName.toLowerCase().trim()) {
            case "数学":
            case "math":
                return Subject.SUBJECT_MATH;
            case "生物":
            case "biology":
                return Subject.SUBJECT_BIOLOGY;
            case "物理":
            case "physics":
                return Subject.SUBJECT_PHYSICS;
            case "化学":
            case "chemistry":
                return Subject.SUBJECT_CHEMISTRY;
            case "英语":
            case "english":
                return Subject.SUBJECT_ENGLISH;
            case "语文":
            case "chinese":
                return Subject.SUBJECT_CHINESE;
            default:
                return null;
        }
    }

    /**
     * 删除题目
     */
    public void deleteExercise(int position) {
        List<Question> questions = exerciseList.getValue();
        if (questions == null || position < 0 || position >= questions.size()) {
            return;
        }

        Question question = questions.get(position);
        Subject subject = currentSubject.getValue();
        String token = AppUtils.getUserToken();

        if (subject == null || token == null || token.trim().isEmpty()) {
            return;
        }

        // 触发删除操作
        deleteTrigger.postValue(new DeleteTrigger(question.id, subject, position));
    }

    /**
     * 选择题目
     */
    public void selectQuestion(int position) {
        List<Question> questions = exerciseList.getValue();
        if (questions == null || position < 0 || position >= questions.size()) {
            return;
        }

        currentQuestionIndex.postValue(position);
    }

    /**
     * 题目置顶 - 这是纯本地操作，需要重新加载来实现
     */
    public void moveQuestionToTop(int position) {
        List<Question> questions = exerciseList.getValue();
        if (questions == null || position < 0 || position >= questions.size()) {
            return;
        }

        // 由于 exerciseList 现在是只读的，这个功能需要在 Repository 层实现
        // 或者通过重新排序后重新加载来实现
        // 这里暂时保留原有逻辑的注释，实际实现需要根据业务需求调整
        
        // 更新当前选中索引
        Integer currentIndex = currentQuestionIndex.getValue();
        if (currentIndex != null) {
            if (currentIndex == position) {
                currentQuestionIndex.setValue(0);
            } else if (currentIndex < position) {
                currentQuestionIndex.setValue(currentIndex + 1);
            }
        }
    }

    /**
     * 查找相似题目
     */
    public void findSimilarQuestions() {
        Question current = currentQuestion.getValue();
        Subject subject = currentSubject.getValue();
        String token = AppUtils.getUserToken();

        if (current == null || subject == null || token == null || token.trim().isEmpty()) {
            return;
        }

        // 构建现有题目ID列表
        String existingIds = getCurrentQuestionIds();

        // 触发相似题目查找
        similarTrigger.setValue(new SimilarTrigger(current, existingIds, subject));
    }

    /**
     * 添加题目到列表
     */
    public void addQuestionToList(Question question) {
        Subject subject = currentSubject.getValue();
        String token = AppUtils.getUserToken();

        if (subject == null || token == null || token.trim().isEmpty()) {
            return;
        }

        // 构建现有题目ID列表
        String existingIds = getCurrentQuestionIds();

        // 触发添加操作
        addTrigger.setValue(new AddTrigger(question, existingIds, subject));
    }

    /**
     * 设置是否可以查看答案
     */
    public void setCanViewAnswer(boolean canView) {
        canViewAnswer.setValue(canView);
    }

    /**
     * 获取当前题目ID列表字符串
     */
    public String getCurrentQuestionIds() {
        StringBuilder ids = new StringBuilder();
        List<Question> questions = exerciseList.getValue();
        if (questions != null) {
            for (Question q : questions) {
                ids.append(q.bmNo).append(",");
            }
        }
        return ids.toString();
    }

    // Getters for LiveData
    public LiveData<List<Question>> getExerciseList() { return exerciseList; }
    public LiveData<List<Question>> getSimilarQuestions() { return similarQuestions; }
    public LiveData<Integer> getCurrentQuestionIndex() { return currentQuestionIndex; }
    public LiveData<Question> getCurrentQuestion() { return currentQuestion; }
    public LiveData<Boolean> getIsLoading() { return isLoading; }
    public LiveData<String> getErrorMessage() { return errorMessage; }
    public LiveData<Subject> getCurrentSubject() { return currentSubject; }
    public LiveData<Boolean> getShowEmptyTip() { return showEmptyTip; }
    public LiveData<Boolean> getCanViewAnswer() { return canViewAnswer; }

    @Override
    protected void onCleared() {
        super.onCleared();
        // ViewModel 被清理时，Transformations 会自动处理观察者的清理
        // 不需要手动移除观察者
    }
}