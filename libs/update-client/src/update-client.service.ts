import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';

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

  async update(ids: number[]): Promise<void> {
    await lastValueFrom(
      this.httpService.put('/movie', {
        updateData: this.updateData,
        ids,
      }),
    );
  }

  async setImdbRelation(kinopoiskId: number, imdbId: string): Promise<void> {
    await lastValueFrom(
      this.httpService.put('/movie', {
        updateData: ['base'],
        ids: [kinopoiskId],
        data: {
          externalId: {
            imdb: imdbId,
          },
        },
      }),
    );
  }
}
