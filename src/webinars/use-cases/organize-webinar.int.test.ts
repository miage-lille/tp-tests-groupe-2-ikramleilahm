import { PrismaClient } from '@prisma/client';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { exec } from 'child_process';
import { FixedDateGenerator } from 'src/core/adapters/fixed-date-generator';
import { FixedIdGenerator } from 'src/core/adapters/fixed-id-generator';
import { IDateGenerator } from 'src/core/ports/date-generator.interface';
import { IIdGenerator } from 'src/core/ports/id-generator.interface';
import { PrismaWebinarRepository } from 'src/webinars/adapters/webinar-repository.prisma';
import { OrganizeWebinars } from 'src/webinars/use-cases/organize-webinar';
import { promisify } from 'util';

const asyncExec = promisify(exec);

describe('OrganizeWebinars integration', () => {
  jest.setTimeout(30000);

  let container: StartedPostgreSqlContainer;
  let prismaClient: PrismaClient;
  let repository: PrismaWebinarRepository;
  let useCase: OrganizeWebinars;
  let idGenerator: IIdGenerator;
  let dateGenerator: IDateGenerator;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:15')
      .withDatabase('test_db')
      .withUsername('user_test')
      .withPassword('password_test')
      .withExposedPorts(5432)
      .start();

    const dbUrl = container.getConnectionUri();
    prismaClient = new PrismaClient({
      datasources: {
        db: { url: dbUrl },
      },
    });

    await asyncExec('npx prisma migrate deploy', {
      env: {
        ...process.env,
        DATABASE_URL: dbUrl,
      },
    });

    return prismaClient.$connect();
  });

  beforeEach(async () => {
    repository = new PrismaWebinarRepository(prismaClient);
    idGenerator = new FixedIdGenerator();
    dateGenerator = new FixedDateGenerator(new Date('2024-01-01T00:00:00Z'));
    useCase = new OrganizeWebinars(repository, idGenerator, dateGenerator);

    await prismaClient.webinar.deleteMany();
    await prismaClient.$executeRawUnsafe('DELETE FROM "Webinar" CASCADE');
  });

  afterAll(async () => {
    await container.stop({ timeout: 1000 });
    return prismaClient.$disconnect();
  });

  describe('Scenario: happy path', () => {
    it('should create a webinar in the database', async () => {
      // ARRANGE
      const payload = {
        userId: 'user-alice-id',
        title: 'Webinar title',
        seats: 100,
        startDate: new Date('2024-01-10T10:00:00.000Z'),
        endDate: new Date('2024-01-10T11:00:00.000Z'),
      };

      // ACT
      const result = await useCase.execute(payload);

      // ASSERT
      expect(result).toEqual({ id: 'id-1' });

      const createdWebinar = await prismaClient.webinar.findUnique({
        where: { id: 'id-1' },
      });
      expect(createdWebinar).toEqual({
        id: 'id-1',
        organizerId: 'user-alice-id',
        title: 'Webinar title',
        startDate: new Date('2024-01-10T10:00:00.000Z'),
        endDate: new Date('2024-01-10T11:00:00.000Z'),
        seats: 100,
      });
    });
  });
});
