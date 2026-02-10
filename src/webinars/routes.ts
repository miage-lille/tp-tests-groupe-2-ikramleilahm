import { FastifyInstance } from 'fastify';
import { AppContainer } from 'src/container';
import { User } from 'src/users/entities/user.entity';
import { WebinarDatesTooSoonException } from 'src/webinars/exceptions/webinar-dates-too-soon';
import { WebinarNotFoundException } from 'src/webinars/exceptions/webinar-not-found';
import { WebinarNotEnoughSeatsException } from 'src/webinars/exceptions/webinar-not-enough-seats';
import { WebinarNotOrganizerException } from 'src/webinars/exceptions/webinar-not-organizer';
import { WebinarTooManySeatsException } from 'src/webinars/exceptions/webinar-too-many-seats';

export async function webinarRoutes(
  fastify: FastifyInstance,
  container: AppContainer,
) {
  const changeSeatsUseCase = container.getChangeSeatsUseCase();
  const organizeWebinarsUseCase = container.getOrganizeWebinarsUseCase();

  fastify.post<{
    Body: { seats: string };
    Params: { id: string };
  }>('/webinars/:id/seats', {}, async (request, reply) => {
    const changeSeatsCommand = {
      seats: parseInt(request.body.seats, 10),
      webinarId: request.params.id,
      user: new User({
        id: 'test-user',
        email: 'test@test.com',
        password: 'fake',
      }),
    };

    try {
      await changeSeatsUseCase.execute(changeSeatsCommand);
      reply.status(200).send({ message: 'Seats updated' });
    } catch (err) {
      if (err instanceof WebinarNotFoundException) {
        return reply.status(404).send({ error: err.message });
      }
      if (err instanceof WebinarNotOrganizerException) {
        return reply.status(401).send({ error: err.message });
      }
      reply.status(500).send({ error: 'An error occurred' });
    }
  });

  fastify.post<{
    Body: {
      title: string;
      seats: number;
      startDate: string;
      endDate: string;
      userId: string;
    };
  }>('/webinars', {}, async (request, reply) => {
    const organizeCommand = {
      title: request.body.title,
      seats: request.body.seats,
      startDate: new Date(request.body.startDate),
      endDate: new Date(request.body.endDate),
      userId: request.body.userId,
    };

    try {
      const result = await organizeWebinarsUseCase.execute(organizeCommand);
      reply.status(201).send(result);
    } catch (err) {
      if (
        err instanceof WebinarDatesTooSoonException ||
        err instanceof WebinarTooManySeatsException ||
        err instanceof WebinarNotEnoughSeatsException
      ) {
        return reply.status(400).send({ error: err.message });
      }
      reply.status(500).send({ error: 'An error occurred' });
    }
  });
}
