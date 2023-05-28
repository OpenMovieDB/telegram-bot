import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';

type UpdateResponse = {
  movieStatuses: { id: number; status: 'found' | 'not found' }[];
};

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

  async update(ids: number[]): Promise<UpdateResponse> {
    const { data } = await lastValueFrom(
      this.httpService.put<UpdateResponse>('/movie/sync', {
        updateData: this.updateData,
        ids,
      }),
    );
    return data;
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
