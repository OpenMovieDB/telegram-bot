import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';

@Injectable()
export class UpdateClientService {
  private readonly updateData = [
    'base',
    'premiere',
    'facts',
    'fees',
    'budget',
    'videos',
    'similarMovies',
    'images',
    'imagesInfo',
    'persons',
    'allDataPersons',
    'sequelsAndPrequels',
    'reviews',
  ];

  constructor(private readonly httpService: HttpService) {}

  update(ids: number[]) {
    return this.httpService.put('/movie', {
      updateData: this.updateData,
      ids,
    });
  }
}
