package com.cosinetech.imates.coreapiservice;

import com.cosinetech.imates.models.TextbookResponse;

import retrofit2.Call;
import retrofit2.http.GET;
import retrofit2.http.Url;

public interface TextbookApiService {
    @GET
    Call<TextbookResponse> getTextbooks(@Url String url);

    @GET("resources.json")
    Call<TextbookResponse> getBiologyTextbooks();

    @GET("resources.json")
    Call<TextbookResponse> getMathTextbooks();
}
