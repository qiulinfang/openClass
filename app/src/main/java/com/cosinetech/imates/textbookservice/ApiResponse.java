package com.cosinetech.imates.textbookservice;

public class ApiResponse<T> {
    public int code;
    public boolean success;
    public String message;
    public T data;
}
